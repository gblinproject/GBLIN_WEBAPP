/**
 * POST /api/x402/seal — AI ACTION RECEIPTS (paid, $0.01 USDC via x402).
 *
 * Seals the HASHES of an AI action (never content) into GBLIN's public
 * append-only transparency log and returns a portable receipt: Ed25519
 * signature + RFC 6962 inclusion proof + C2SP signed checkpoint. The tree
 * root is anchored daily on Base via EAS. Reading and verification are free
 * forever (worker /v1/receipt/:index, /log/*; offline verifier in the
 * gblin-treasury-risk-regime repo). A seal proves existence and time — it is
 * NOT a compliance certificate and NOT an endorsement of the content. The
 * checkpoint is cosigned by a third-party witness, which attests only that the
 * log stayed append-only between the sizes that witness saw: never that a
 * sealed action is true.
 *
 * Payment is enforced by the x402 middleware (same pipeline as /attestation).
 * This route only forwards the validated JSON to the Worker, which owns the
 * log and the signing key (RLOG_KEY). Shared secret: CATALOG_TOKEN.
 *
 * It also forwards WHAT THIS SERVER SAW of the payment. Why: on 22 Aug 2026 a
 * third party reading our log pointed out that we had asserted a real payment
 * for a receipt whose bytes carried no amount, no chain and no transaction —
 * and our own /v1/verify said provenance_level: self-reported. He was right.
 * A receipt for a paid seal must carry the payment or say nothing about it.
 *
 * What is recorded comes from the x402 payment header the middleware has just
 * verified, never from the request body: the caller cannot write itself a
 * payment it did not make. There is no settlement transaction hash because the
 * server does not know it at seal time — instead we record the EIP-3009
 * authorization nonce, which is better than our word: USDC on Base emits
 * AuthorizationUsed(authorizer, nonce) in the settlement, so any reader can
 * find that transaction from payer + nonce on their own.
 */
export const runtime = "nodejs";

const WORKER = "https://gblin-mcp.gblin-mcp-worker.workers.dev";
// Devono combaciare con src/middleware.ts: sono i termini che il paywall applica qui.
const NETWORK = "eip155:8453";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** Il minimo che serve per rimborsare e per farsi credere: chi ha pagato e con che nonce. */
type Prova = { payer: string; nonce: string; amount?: string; asset?: string; network?: string };

function provaDa(osservato: string | null): Prova | null {
  if (!osservato) return null;
  try {
    const o = JSON.parse(Buffer.from(osservato, "base64").toString("utf-8")) as Record<string, string>;
    if (!o.payer || !o.authorization_nonce) return null;
    return { payer: o.payer, nonce: o.authorization_nonce, amount: o.amount, asset: o.asset, network: o.network };
  } catch {
    return null;
  }
}

/**
 * Cosa si aggiunge a un errore quando chi lo riceve HA GIA' PAGATO.
 *
 * Il 05/09/2026 qualcuno ha pagato 0,01 USDC per un sigillo e non ha ricevuto niente. Non
 * sapevamo nemmeno come fosse fallito, perche' questo percorso non registrava nulla e non
 * diceva nulla. Da qui in poi ogni fallimento su una chiamata pagata porta con se' il nonce,
 * che e' verificabile on-chain (USDC su Base emette AuthorizationUsed(authorizer, nonce)) e
 * quindi vale piu' della nostra parola.
 */
function pagato(p: Prova | null) {
  if (!p) return {};
  return {
    paid: true,
    payment_nonce: p.nonce,
    refund:
      "You paid and received nothing. This is recorded in our refund ledger (counts public at " +
      "gblin-mcp.gblin-mcp-worker.workers.dev/refunds). Quote this nonce to gblin.digital — it is " +
      "provable on-chain from AuthorizationUsed(authorizer, nonce).",
  };
}

/**
 * Riporta l'esito al Worker, che tiene i contatori e il registro dei rimborsi.
 * Fallisce in silenzio e con un tetto di tempo stretto: la contabilita' non deve mai
 * aggiungere ritardo o un secondo errore a chi ne ha gia' preso uno.
 */
async function segnala(motivo: string, p: Prova | null): Promise<void> {
  const token = process.env.CATALOG_TOKEN ?? "";
  if (!token) return;
  try {
    await fetch(`${WORKER}/internal/esito?token=${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chiave: "seal-paid",
        motivo,
        percorso: "/api/x402/seal",
        pagamento: p ? { payer: p.payer, nonce: p.nonce, amount: p.amount, asset: p.asset, network: p.network } : undefined,
      }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    /* la contabilita' non e' un motivo per peggiorare la giornata di chi ha pagato */
  }
}

export async function POST(req: Request) {
  const token = process.env.CATALOG_TOKEN ?? "";
  if (!token) {
    return Response.json(
      { error: "seal service not configured (CATALOG_TOKEN missing)", ...pagato(provaDa(await observePayment(req))) },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const observed = await observePayment(req);
  const prova = provaDa(observed);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await segnala("json", prova);
    return Response.json(
      { error: "invalid JSON body", ...pagato(prova) },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  // Il chiamante ha GIA' pagato quando arriviamo qui: qualsiasi inciampo a valle deve tornargli
  // come errore leggibile, mai come 500 generico della piattaforma. Prima ne' il fetch (timeout
  // 20s incluso) ne' r.json() erano protetti.
  let r: Response;
  try {
    r = await fetch(`${WORKER}/internal/seal?token=${token}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(observed ? { "x-gblin-payment-observed": observed } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    const timeout = e instanceof Error && /timeout|abort/i.test(e.name + e.message);
    await segnala("upstream", prova);
    return Response.json(
      {
        error: timeout ? "seal service did not answer in 20s" : "seal service unreachable",
        retry: "Retry the same body. If it fails again, quote your nonce and we refund.",
        ...pagato(prova),
      },
      { status: 504, headers: { "cache-control": "no-store" } },
    );
  }
  const raw = await r.text();
  let out: unknown;
  try {
    out = JSON.parse(raw);
  } catch {
    await segnala("upstream", prova);
    return Response.json(
      {
        error: "seal service returned a non-JSON response",
        upstream_status: r.status,
        upstream_body: raw.slice(0, 300),
        ...pagato(prova),
      },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
  // Il Worker conta gia' l'esito e registra il rimborso: qui aggiungiamo solo il nonce se lui
  // non l'ha visto (percorso in cui l'osservazione del pagamento non era leggibile).
  const corpo =
    r.status === 200 || (out && typeof out === "object" && "paid" in (out as object))
      ? out
      : { ...(out as object), ...pagato(prova) };
  return Response.json(corpo, {
    status: r.status,
    headers: { "cache-control": "no-store" },
  });
}

/**
 * Ogni metodo che non sia POST riceve lo STESSO 405.
 *
 * Prima solo GET aveva un handler e gli altri cadevano nel 405 predefinito di Next, con un
 * corpo diverso: due risposte diverse per lo stesso errore, e il bordo non poteva rispecchiarle
 * entrambe. Il corpo qui sotto e' replicato in worker/src/x402-challenge.mjs (SOLO_POST_BODY):
 * se cambia uno, va cambiato l'altro, o origin e bordo divergono.
 */
function soloPost() {
  return Response.json(
    {
      error: "POST only",
      how: "POST JSON {action, input_hash, output_hash?, agent_id?, tool?, meta?} with x402 payment ($0.01). Free demo (5/day/IP): POST https://gblin-mcp.gblin-mcp-worker.workers.dev/v1/seal-demo. Docs: /api/x402/llms.txt",
    },
    { status: 405, headers: { allow: "POST", "cache-control": "public, max-age=300" } },
  );
}

export const GET = soloPost;
export const HEAD = soloPost;
export const PUT = soloPost;
export const PATCH = soloPost;
export const DELETE = soloPost;

/**
 * Extract the payment facts from the already-verified x402 header.
 *
 * Deliberately defensive: the exact scheme has more than one payload shape
 * (plain EIP-3009 authorization, Permit2), and a shape we do not recognise must
 * degrade to "less detail", never to a wrong claim or a 500 on a paid call.
 * payload_sha256 always commits to the exact header bytes this server verified,
 * whatever the shape — the signature itself is never published.
 */
async function observePayment(req: Request): Promise<string | null> {
  const header = req.headers.get("x-payment") ?? req.headers.get("payment-signature");
  if (!header) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(header));
    const payloadSha = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

    let decoded: Record<string, unknown> = {};
    try {
      decoded = JSON.parse(Buffer.from(header, "base64").toString("utf-8")) as Record<string, unknown>;
    } catch {
      // unreadable payload: the hash alone is still an honest, checkable record
      return Buffer.from(JSON.stringify({ payload_sha256: payloadSha })).toString("base64");
    }

    const inner = (decoded.payload ?? {}) as Record<string, unknown>;
    const auth = (inner.authorization ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);

    const observation = {
      // Schema, rete e asset NON stanno nel payload di pagamento (misurato sul primo
      // sigillo con prova, il 22/08: l'autorizzazione porta from/to/value/nonce e basta,
      // "10000 unita'" senza dire di cosa). Non li inventiamo dal chiamante: sono i
      // TERMINI CHE QUESTO SERVER HA IMPOSTO su questo percorso, e devono restare
      // allineati a NETWORK e all'asset del middleware x402.
      scheme: str(decoded.scheme) ?? "exact",
      network: str(decoded.network) ?? NETWORK,
      asset: str(decoded.asset) ?? USDC_BASE,
      amount: str(auth.value),
      payer: str(auth.from),
      pay_to: str(auth.to),
      authorization_nonce: str(auth.nonce),
      payload_sha256: payloadSha,
    };
    return Buffer.from(JSON.stringify(observation)).toString("base64");
  } catch {
    return null; // never break a paid call over the bookkeeping
  }
}
