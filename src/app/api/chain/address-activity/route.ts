/**
 * GET /api/chain/address-activity?address=0x…&limit=25
 *
 * GBLIN history of a single address, used by the transaction table on the account page. The read
 * happens on the server so that the RPC key is never exposed to the browser.
 *
 * The address is supplied by the client, so it is the one parameter validated by hand: without a
 * shape check it would reach the RPC call as received.
 */

import { addressActivity, ChainActivityError, GBLIN_CONTRACT } from '@/lib/chain-activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const MAX_LIMIT = 100;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const address = url.searchParams.get('address') ?? '';

  if (!ADDRESS_RE.test(address)) {
    return Response.json(
      { error: 'the `address` parameter is missing or is not an EVM address' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const parsed = Number(url.searchParams.get('limit') ?? '25');
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT) : 25;

  try {
    const data = await addressActivity(address, GBLIN_CONTRACT, limit);
    return Response.json(
      { ...data, address, token: GBLIN_CONTRACT, source: 'alchemy' },
      // Short cache window: after a purchase the page reloads this list, and the caller must see
      // their own transaction in it rather than a copy taken half a minute earlier.
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } },
    );
  } catch (err) {
    const message = err instanceof ChainActivityError ? err.message : 'unexpected error';
    return Response.json(
      { transactions: [], erc20Transfers: [], degraded: true, error: message },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
