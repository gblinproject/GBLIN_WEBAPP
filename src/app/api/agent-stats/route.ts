/**
 * GET /api/agent-stats
 *
 * Contatori dei pagamenti x402 ricevuti dal fee wallet, per la sezione "AI Agents".
 *
 * Fonte: Alchemy (`alchemy_getAssetTransfers`) — vedi src/lib/chain-activity.ts.
 * 01/09/2026: sostituisce Moralis, che ha spento il piano gratuito.
 *
 * COSA CONTA, E PERCHE' DUE NUMERI
 * La promessa P2 (hash-pinnata, public/promises/P2-honest-counters.json) dichiara che i
 * contatori pubblici sono CUMULATIVI DALL'INIZIO e INCLUDONO i nostri wallet, e che la
 * lista dei nostri wallet è pubblicata perché un estraneo possa riprodurre lo split fra
 * attività interna ed esterna. Quindi:
 *   - `total_*` resta cumulativo e include i nostri wallet: cambiarlo renderebbe falsa una
 *     promessa già incisa on-chain (servirebbe una P2 v2 con un nuovo promiseId).
 *   - `organic` è quello split, calcolato qui invece di lasciarlo come compito al lettore.
 * La lista dei wallet interni è letta DAL FILE DELLA PROMESSA, non ricopiata: una sola
 * fonte, e se il file cambia il conteggio cambia con lui.
 */

import { inboundTokenPayments, USDC_BASE, FEE_WALLET } from '@/lib/chain-activity';
import promise from '../../../../public/promises/P2-honest-counters.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OUR_WALLETS = new Set(
  (promise.our_wallets ?? []).map((w: string) => w.toLowerCase()),
);

// ─── Cache in memoria ────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1_000;
const ERROR_CACHE_TTL_MS = 30_000;
let cache: { data: AgentStats; fetchedAt: number } | null = null;

interface Split {
  paid_calls: number;
  unique_agents: number;
  usdc: number;
}

export interface AgentStats {
  total_paid_calls: number;
  total_unique_agents: number;
  total_usdc_earned: number;
  /** Solo pagatori esterni: i wallet elencati nella promessa P2 sono esclusi. */
  organic: Split;
  /** La quota generata dai nostri wallet, dichiarata invece che nascosta. */
  internal: Split;
  our_wallets_source: string;
  last_payment_at: string | null;
}

const EMPTY_SPLIT: Split = { paid_calls: 0, unique_agents: 0, usdc: 0 };
const EMPTY_STATS: AgentStats = {
  total_paid_calls: 0,
  total_unique_agents: 0,
  total_usdc_earned: 0,
  organic: EMPTY_SPLIT,
  internal: EMPTY_SPLIT,
  our_wallets_source: 'https://gblin.digital/promises/P2-honest-counters.json',
  last_payment_at: null,
};

// Blocco di attribuzione — additivo, consumato da terzi che citano i nostri dati.
const SOURCE = {
  name: 'GBLIN Agent Economy Observatory',
  url: 'https://gblin.digital/observatory',
  data_endpoint: 'https://gblin.digital/api/agent-stats',
  docs: 'https://gblin.digital/llms.txt',
  license: "CC BY 4.0 — cite 'GBLIN Agent Economy Observatory'",
  disclosure:
    'GBLIN operates paid x402 endpoints. Per promise P2, total_* counters are cumulative since launch and include payments made by our own wallets; the `organic` block excludes them, using the wallet list published in P2. Methodology is public.',
} as const;

async function fetchAgentStats(): Promise<AgentStats> {
  const payments = await inboundTokenPayments(FEE_WALLET, USDC_BASE);

  const agents = { all: new Set<string>(), organic: new Set<string>(), internal: new Set<string>() };
  let totalMicro = 0n;
  let organicMicro = 0n;
  let internalMicro = 0n;
  let organicCalls = 0;
  let internalCalls = 0;
  let lastAt: string | null = null;

  for (const p of payments) {
    // Un trasferimento del fee wallet verso se stesso non è un pagamento ricevuto.
    if (p.from === FEE_WALLET.toLowerCase()) continue;

    let micro = 0n;
    try {
      micro = BigInt(p.value);
    } catch {
      // valore malformato: la chiamata conta, l'importo no
    }

    agents.all.add(p.from);
    totalMicro += micro;
    if (p.timestamp && (!lastAt || p.timestamp > lastAt)) lastAt = p.timestamp;

    if (OUR_WALLETS.has(p.from)) {
      agents.internal.add(p.from);
      internalCalls += 1;
      internalMicro += micro;
    } else {
      agents.organic.add(p.from);
      organicCalls += 1;
      organicMicro += micro;
    }
  }

  const usdc = (v: bigint) => Number(v) / 1e6;

  return {
    total_paid_calls: organicCalls + internalCalls,
    total_unique_agents: agents.all.size,
    total_usdc_earned: usdc(totalMicro),
    organic: {
      paid_calls: organicCalls,
      unique_agents: agents.organic.size,
      usdc: usdc(organicMicro),
    },
    internal: {
      paid_calls: internalCalls,
      unique_agents: agents.internal.size,
      usdc: usdc(internalMicro),
    },
    our_wallets_source: 'https://gblin.digital/promises/P2-honest-counters.json',
    last_payment_at: lastAt,
  };
}

export async function GET(): Promise<Response> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return Response.json(
      { ...cache.data, _source: SOURCE },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } },
    );
  }

  try {
    const data = await fetchAgentStats();
    cache = { data, fetchedAt: now };
    return Response.json(
      { ...data, _source: SOURCE },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } },
    );
  } catch (err) {
    // Mai un 500: la home deve renderizzare. Si serve la cache precedente, altrimenti zeri
    // DICHIARATI come tali — uno zero non deve poter passare per "nessuno ha pagato".
    const fallback = cache?.data ?? EMPTY_STATS;
    cache = { data: fallback, fetchedAt: now - (CACHE_TTL_MS - ERROR_CACHE_TTL_MS) };
    return Response.json(
      {
        ...fallback,
        stale: true,
        error: (err as Error).message,
        _source: SOURCE,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  }
}
