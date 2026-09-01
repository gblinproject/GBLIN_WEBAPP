/**
 * GET /api/chain/contract-activity?limit=10
 *
 * Attività recente del contratto GBLIN: le transazioni che lo toccano più i trasferimenti
 * ERC-20 che ne derivano. Serve la tabella "recent transactions" della home e la classifica
 * dei keeper.
 *
 * 01/09/2026: prende il posto delle chiamate Moralis che i componenti facevano DAL BROWSER
 * con la chiave in chiaro (`NEXT_PUBLIC_MORALIS_API_KEY`). Passando dal server la chiave
 * Alchemy resta segreta e la risposta si cachea sulla CDN invece di essere rifatta da ogni
 * visitatore — che era il TODO(security) già scritto in protocol-data.ts.
 *
 * `dynamic = 'force-dynamic'`: senza, Next pre-renderizzerebbe la rotta AL BUILD e il build
 * dipenderebbe dalla velocità di Alchemy (è così che il build è fallito il 30/08).
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
    const message = err instanceof ChainActivityError ? err.message : 'errore imprevisto';
    // 503 e non 200-con-lista-vuota: una lista vuota qui significherebbe "nessuna
    // transazione", che è un'affermazione diversa da "non ho potuto guardare".
    return Response.json(
      { transactions: [], erc20Transfers: [], degraded: true, error: message },
      { status: 503, headers: { 'Cache-Control': 'public, s-maxage=30' } },
    );
  }
}
