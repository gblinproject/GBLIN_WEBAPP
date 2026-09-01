/**
 * GET /api/chain/address-activity?address=0x…&limit=25
 *
 * Storico GBLIN di un indirizzo, per la tabella transazioni di /account.
 * 01/09/2026: prende il posto delle due chiamate Moralis fatte dal browser.
 *
 * L'indirizzo arriva dal client, quindi è il solo parametro validato a mano: senza il
 * controllo di forma finirebbe dentro una chiamata RPC così com'è.
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
      { error: 'parametro `address` mancante o non è un indirizzo EVM' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const parsed = Number(url.searchParams.get('limit') ?? '25');
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT) : 25;

  try {
    const data = await addressActivity(address, GBLIN_CONTRACT, limit);
    return Response.json(
      { ...data, address, token: GBLIN_CONTRACT, source: 'alchemy' },
      // Cache corta: dopo un acquisto la pagina ricarica questa lista e l'utente deve
      // vederci dentro la propria transazione, non una copia di trenta secondi prima.
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } },
    );
  } catch (err) {
    const message = err instanceof ChainActivityError ? err.message : 'errore imprevisto';
    return Response.json(
      { transactions: [], erc20Transfers: [], degraded: true, error: message },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
