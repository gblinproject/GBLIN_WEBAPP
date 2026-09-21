/**
 * GET /api/chain/contract-activity?limit=10
 *
 * Recent activity of the GBLIN contract: the transactions that touch it plus the ERC-20 transfers
 * they produce. Backs the recent-transactions table and the keeper leaderboard.
 *
 * The read happens on the server so that the RPC key is never exposed to the browser and the
 * response is cached on the CDN instead of being recomputed for every visitor.
 *
 * `dynamic = 'force-dynamic'` is required: without it Next pre-renders the route at build time,
 * which would make the build depend on the availability of a third-party RPC provider.
 */

import { contractActivity, ChainActivityError, GBLIN_CONTRACT } from '@/lib/chain-activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 200;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = Number(url.searchParams.get('limit') ?? '10');
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT) : 10;

  try {
    const data = await contractActivity(GBLIN_CONTRACT, limit);
    return Response.json(
      { ...data, contract: GBLIN_CONTRACT, source: 'alchemy' },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } },
    );
  } catch (err) {
    const message = err instanceof ChainActivityError ? err.message : 'unexpected error';
    // 503 rather than 200 with an empty list: an empty list would assert "no transactions", which
    // is a different claim from "the source could not be read".
    return Response.json(
      { transactions: [], erc20Transfers: [], degraded: true, error: message },
      { status: 503, headers: { 'Cache-Control': 'public, s-maxage=30' } },
    );
  }
}
