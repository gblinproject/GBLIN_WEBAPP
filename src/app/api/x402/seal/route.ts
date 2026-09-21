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
 * It also forwards WHAT THIS SERVER SAW of the payment. A receipt for a paid
 * seal either carries the payment or says nothing about it: a receipt whose
 * bytes hold no amount, no chain and no transaction cannot back a claim that a
 * real payment took place, and /v1/verify reports it as provenance_level:
 * self-reported.
 *
 * What is recorded comes from the x402 payment header the middleware has just
 * verified, never from the request body: the caller cannot write itself a
 * payment it did not make. There is no settlement transaction hash because the
 * server does not know it at seal time — the EIP-3009 authorization nonce is
 * recorded instead, and it is stronger than an assertion: USDC on Base emits
 * AuthorizationUsed(authorizer, nonce) in the settlement, so any reader can
 * find that transaction from payer + nonce independently.
 */
export const runtime = "nodejs";

const WORKER = "https://gblin-mcp.gblin-mcp-worker.workers.dev";
// These must match src/middleware.ts: they are the terms the paywall enforces on this route.
const NETWORK = "eip155:8453";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** The minimum needed to refund and to be checkable: who paid, and with which nonce. */
type Evidence = { payer: string; nonce: string; amount?: string; asset?: string; network?: string };

function evidenceFrom(observedHeader: string | null): Evidence | null {
  if (!observedHeader) return null;
  try {
    const o = JSON.parse(Buffer.from(observedHeader, "base64").toString("utf-8")) as Record<string, string>;
    if (!o.payer || !o.authorization_nonce) return null;
    return { payer: o.payer, nonce: o.authorization_nonce, amount: o.amount, asset: o.asset, network: o.network };
  } catch {
    return null;
  }
}

/**
 * What is added to an error when the caller HAS ALREADY PAID.
 *
 * A failure on a paid call carries the authorization nonce, which is verifiable
 * on-chain (USDC on Base emits AuthorizationUsed(authorizer, nonce)) and is
 * therefore stronger than an assertion by this server: it lets the caller claim
 * the refund and lets anyone confirm the charge independently.
 */
function paid(p: Evidence | null) {
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
 * Reports the outcome upstream, where the counters and the refund ledger live.
 * Fails silently and under a tight timeout: bookkeeping must never add latency,
 * nor a second error, for a caller that has already hit one.
 */
async function report(reason: string, p: Evidence | null): Promise<void> {
  const token = process.env.CATALOG_TOKEN ?? "";
  if (!token) return;
  try {
    // The two services deploy separately, so the reader accepts both the current and the
    // previous spelling of these fields. Sending both keeps the outcome of a paid failure
    // from being dropped while one side is still the older build.
    const payment = p
      ? { payer: p.payer, nonce: p.nonce, amount: p.amount, asset: p.asset, network: p.network }
      : undefined;
    await fetch(`${WORKER}/internal/outcome?token=${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: "seal-paid",
        reason,
        path: "/api/x402/seal",
        payment,
        chiave: "seal-paid",
        motivo: reason,
        percorso: "/api/x402/seal",
        pagamento: payment,
      }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    /* bookkeeping is never a reason to degrade the response of a paying caller */
  }
}

export async function POST(req: Request) {
  const token = process.env.CATALOG_TOKEN ?? "";
  if (!token) {
    return Response.json(
      { error: "seal service not configured (CATALOG_TOKEN missing)", ...paid(evidenceFrom(await observePayment(req))) },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const observed = await observePayment(req);
  const evidence = evidenceFrom(observed);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await report("json", evidence);
    return Response.json(
      { error: "invalid JSON body", ...paid(evidence) },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  // The caller has ALREADY paid by this point: any downstream failure has to
  // come back as a readable error, never as a generic platform 500. Both the
  // fetch (timeout included) and the JSON parse below are guarded for that
  // reason.
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
    await report("upstream", evidence);
    return Response.json(
      {
        error: timeout ? "seal service did not answer in 20s" : "seal service unreachable",
        retry: "Retry the same body. If it fails again, quote your nonce and we refund.",
        ...paid(evidence),
      },
      { status: 504, headers: { "cache-control": "no-store" } },
    );
  }
  const raw = await r.text();
  let out: unknown;
  try {
    out = JSON.parse(raw);
  } catch {
    await report("upstream", evidence);
    return Response.json(
      {
        error: "seal service returned a non-JSON response",
        upstream_status: r.status,
        upstream_body: raw.slice(0, 300),
        ...paid(evidence),
      },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
  // The upstream already counts the outcome and records the refund: the nonce
  // is added here only when the upstream did not see it (the path where the
  // payment observation was not readable).
  const responseBody =
    r.status === 200 || (out && typeof out === "object" && "paid" in (out as object))
      ? out
      : { ...(out as object), ...paid(evidence) };
  return Response.json(responseBody, {
    status: r.status,
    headers: { "cache-control": "no-store" },
  });
}

/**
 * Every method other than POST receives the SAME 405.
 *
 * Letting some methods fall through to the framework default produces a
 * different body for the same error, which cannot be mirrored consistently by
 * anything serving this challenge in front of the origin. The body below is
 * part of the public contract: whoever mirrors it has to change with it, or the
 * two responses diverge.
 */
function postOnly() {
  return Response.json(
    {
      error: "POST only",
      how: "POST JSON {action, input_hash, output_hash?, agent_id?, tool?, meta?} with x402 payment ($0.01). Free demo (5/day/IP): POST https://gblin-mcp.gblin-mcp-worker.workers.dev/v1/seal-demo. Docs: /api/x402/llms.txt",
    },
    { status: 405, headers: { allow: "POST", "cache-control": "public, max-age=300" } },
  );
}

export const GET = postOnly;
export const HEAD = postOnly;
export const PUT = postOnly;
export const PATCH = postOnly;
export const DELETE = postOnly;

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
      // Scheme, network and asset are NOT part of the payment payload: the
      // authorization only carries from/to/value/nonce, so an amount alone
      // says "10000 units" without saying of what. They are not inferred from
      // the caller either: they are the TERMS THIS SERVER IMPOSES on this
      // route, and must stay aligned with NETWORK and with the asset declared
      // by the x402 middleware.
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
