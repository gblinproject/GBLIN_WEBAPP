/**
 * GET /api/chain/yield-distributed
 *
 * Somma di tutti gli eventi `YieldDistributed` del contratto: è lo yield che rientra nel NAV
 * a ogni acquisto, e in home è una cifra pubblica.
 *
 * 01/09/2026 — perché è diventata una rotta server. La lettura la faceva il browser, con
 * Blockscout come fonte e `getLogs` a finestre di 9.000 blocchi come ripiego. Misurato oggi:
 * Blockscout NON è giù, è INTERMITTENTE (su cinque tentativi: 200, 500, 500, 200, 429), e il
 * ripiego non ripiega più — il piano gratuito di Alchemy limita `eth_getLogs` a 10 blocchi,
 * quindi ogni finestra falliva dentro un `catch` che restituiva lista vuota. Risultato: la
 * cifra pubblicata oscillava fra il valore vero e ZERO a seconda del tentativo.
 *
 * Qui il tentativo si ripete (l'intermittenza si cura con la pazienza, non con un ripiego che
 * non funziona) e, se proprio non si ottiene nulla, si serve l'ultimo valore buono dichiarando
 * che è vecchio. Il numero non torna mai a zero per un errore di rete: zero significherebbe
 * "non abbiamo mai distribuito nulla", che è un'altra affermazione.
 */

import { GBLIN_CONTRACT } from '@/lib/chain-activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// keccak256("YieldDistributed(uint256)") — costante, non serve ethers per calcolarla.
const YIELD_TOPIC = '0xe8ed0a697f15301f06fd3d30bc896682e7826c5397076a3eda05844cfc356480';
/**
 * Sorgente configurabile: il tetto di richieste di Blockscout senza chiave è basso (poche
 * chiamate ravvicinate ci hanno bloccati per minuti). Con una chiave gratuita di
 * dev.blockscout.com basta cambiare questa variabile d'ambiente.
 */
const BLOCKSCOUT = process.env.BLOCKSCOUT_API_URL ?? 'https://base.blockscout.com/api';

const CACHE_TTL_MS = 10 * 60 * 1_000;
let cache: { totalWei: string; events: number; fetchedAt: number } | null = null;

async function readFromBlockscout(): Promise<{ totalWei: bigint; events: number }> {
  const url =
    `${BLOCKSCOUT}?module=logs&action=getLogs&fromBlock=0&toBlock=latest` +
    `&address=${GBLIN_CONTRACT}&topic0=${YIELD_TOPIC}`;

  let lastError = 'nessun tentativo';
  // Due tentativi, e MAI un secondo dopo un 429: Blockscout senza chiave ha un tetto basso
  // e insistere allunga il blocco invece di risolverlo (verificato — tre tentativi ravvicinati
  // ci hanno fatto bloccare per minuti). Sul 500, che è transitorio, il secondo colpo paga.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1_500));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(9_000), cache: 'no-store' });
      if (!res.ok) {
        lastError = `Blockscout HTTP ${res.status}`;
        if (res.status === 429) break;
        continue;
      }
      const data = (await res.json()) as { result?: Array<{ data: string }>; message?: string };
      if (!Array.isArray(data.result)) {
        lastError = `Blockscout: ${data.message ?? 'risposta senza result'}`;
        continue;
      }
      let total = 0n;
      for (const log of data.result) {
        try {
          total += BigInt(log.data);
        } catch {
          // un log illeggibile non deve azzerare la somma degli altri
        }
      }
      return { totalWei: total, events: data.result.length };
    } catch (err) {
      lastError = (err as Error).message;
    }
  }
  throw new Error(lastError);
}

export async function GET(): Promise<Response> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return Response.json(
      { total_wei: cache.totalWei, events: cache.events, source: 'blockscout' },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400' } },
    );
  }

  try {
    const { totalWei, events } = await readFromBlockscout();
    cache = { totalWei: totalWei.toString(), events, fetchedAt: now };
    return Response.json(
      { total_wei: totalWei.toString(), events, source: 'blockscout' },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400' } },
    );
  } catch (err) {
    if (cache) {
      return Response.json(
        {
          total_wei: cache.totalWei,
          events: cache.events,
          source: 'blockscout',
          stale: true,
          stale_since: new Date(cache.fetchedAt).toISOString(),
          error: (err as Error).message,
        },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=86400' } },
      );
    }
    // Mai `total_wei: 0` come se fosse una misura: qui non sappiamo, e lo diciamo.
    return Response.json(
      { total_wei: null, events: null, degraded: true, error: (err as Error).message },
      { status: 503, headers: { 'Cache-Control': 'public, s-maxage=30' } },
    );
  }
}
