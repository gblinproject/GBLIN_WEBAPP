/**
 * POST /api/x402/seal — AI ACTION RECEIPTS (paid, $0.01 USDC via x402).
 *
 * Seals the HASHES of an AI action (never content) into GBLIN's public
 * append-only transparency log and returns a portable receipt: Ed25519
 * signature + RFC 6962 inclusion proof + C2SP signed checkpoint. The tree
 * root is anchored daily on Base via EAS. Reading and verification are free
 * forever (worker /v1/receipt/:index, /log/*; offline verifier in the
 * gblin-treasury-risk-regime repo). A seal proves existence and time,
 * independently witnessed — it is NOT a compliance certificate and NOT an
 * endorsement of the content.
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

export async function POST(req: Request) {
  const token = process.env.CATALOG_TOKEN ?? "";
  if (!token) {
    return Response.json(
      { error: "seal service not configured (CATALOG_TOKEN missing)" },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const observed = await observePayment(req);
  const r = await fetch(`${WORKER}/internal/seal?token=${token}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(observed ? { "x-gblin-payment-observed": observed } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const out = await r.json();
  return Response.json(out, {
    status: r.status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET() {
  return Response.json(
    {
      error: "POST only",
      how: "POST JSON {action, input_hash, output_hash?, agent_id?, tool?, meta?} with x402 payment ($0.01). Free demo (5/day/IP): POST https://gblin-mcp.gblin-mcp-worker.workers.dev/v1/seal-demo. Docs: /api/x402/llms.txt",
    },
    { status: 405 },
  );
}

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
      scheme: str(decoded.scheme),
      network: str(decoded.network),
      asset: str(decoded.asset),
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
