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
  const r = await fetch(`${WORKER}/internal/seal?token=${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
