/**
 * GET /api/x402/catalog — PAID ($0.005 via x402, gated by src/middleware.ts).
 *
 * The x402 CATALOG OBSERVATORY full feed: factual liveness of the ~200 most
 * recently updated Bazaar listings, probed in rotation by our Cloudflare
 * worker (same instrument that runs our own Coherence Proof). Per endpoint:
 * HTTP code, latency ms, last-OK timestamp, consecutive fails.
 *
 * Probes never pay anyone and never judge — measurements only. The free
 * aggregate view lives on the worker at /catalog; this route sells the
 * per-endpoint detail. Data is pulled from the worker over a shared token
 * (CATALOG_TOKEN env, set both in the worker secrets and here).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKER = "https://gblin-mcp.gblin-mcp-worker.workers.dev";

export async function GET(): Promise<Response> {
  const token = process.env.CATALOG_TOKEN ?? "";
  if (!token) {
    return Response.json(
      { error: "catalog feed not configured (CATALOG_TOKEN missing)" },
      { status: 503 },
    );
  }
  try {
    const r = await fetch(`${WORKER}/catalog/full?token=${token}`, {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`worker HTTP ${r.status}`);
    const feed = await r.json();
    return Response.json(
      {
        ...feed,
        alive_definition:
          "answers within 8s with HTTP 402 + parseable accepts[] challenge, or any 2xx",
        selection_rule:
          "top ~200 listings by lastUpdated on the public CDP discovery catalog, refreshed daily; probed in rotation (~2h cadence each)",
        free_aggregate_view: `${WORKER}/catalog`,
      },
      // paid response: never CDN-cached
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return Response.json(
      { error: "observatory upstream unavailable", detail: (err as Error).message },
      { status: 502 },
    );
  }
}
