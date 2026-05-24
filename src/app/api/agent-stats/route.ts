/**
 * GET /api/agent-stats
 *
 * Returns KPI counters for the "AI Agents" section on the home page.
 *
 * Mirrors the Dune query (id: 7564984):
 *   contract_address = USDC on Base
 *   to               = 0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B  (fee wallet)
 *   from            != zero address
 *
 * Implementation: single HTTP call to BaseScan's free `tokentx` endpoint.
 * No API key required for low traffic (5 req/s shared limit). Set
 * BASESCAN_API_KEY env var for higher limits.
 *
 * Cache: 5 minutes in-memory.
 */

export const runtime = "nodejs";

const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY ?? "";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const FEE_WALLET = "0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ─── In-memory cache ─────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes
let cache: {
  data: AgentStats;
  fetchedAt: number;
} | null = null;

export interface AgentStats {
  total_paid_calls: number;
  total_unique_agents: number;
  total_usdc_earned: number; // in USDC (human-readable)
}

interface BaseScanTokenTx {
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenDecimal: string;
}

async function fetchAgentStats(): Promise<AgentStats> {
  const url = new URL("https://api.basescan.org/api");
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "tokentx");
  url.searchParams.set("contractaddress", USDC);
  url.searchParams.set("address", FEE_WALLET);
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "10000");
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "99999999");
  url.searchParams.set("sort", "asc");
  if (BASESCAN_API_KEY) url.searchParams.set("apikey", BASESCAN_API_KEY);

  const res = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    // BaseScan responds in <1s normally.
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`BaseScan HTTP ${res.status}`);

  const json = (await res.json()) as {
    status: string;
    message: string;
    result: BaseScanTokenTx[] | string;
  };

  // BaseScan returns status "0" with message "No transactions found" for
  // empty results — treat as empty array, not an error.
  if (json.status !== "1") {
    if (typeof json.result === "string" && /no transactions/i.test(json.result)) {
      return { total_paid_calls: 0, total_unique_agents: 0, total_usdc_earned: 0 };
    }
    throw new Error(
      typeof json.result === "string" ? json.result : json.message || "BaseScan error"
    );
  }

  const txs = Array.isArray(json.result) ? json.result : [];
  const uniqueAgents = new Set<string>();
  let totalCalls = 0;
  let totalUsdcMicro = 0n;

  for (const tx of txs) {
    const from = tx.from?.toLowerCase();
    const to = tx.to?.toLowerCase();
    if (!from || !to) continue;
    if (to !== FEE_WALLET.toLowerCase()) continue; // only inbound transfers
    if (from === ZERO_ADDRESS.toLowerCase()) continue;
    uniqueAgents.add(from);
    totalCalls += 1;
    try {
      totalUsdcMicro += BigInt(tx.value);
    } catch {
      // skip malformed value
    }
  }

  return {
    total_paid_calls: totalCalls,
    total_unique_agents: uniqueAgents.size,
    total_usdc_earned: Number(totalUsdcMicro) / 1e6,
  };
}

const EMPTY_STATS: AgentStats = {
  total_paid_calls: 0,
  total_unique_agents: 0,
  total_usdc_earned: 0,
};
const ERROR_CACHE_TTL_MS = 30_000;

export async function GET(): Promise<Response> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return Response.json(cache.data);
  }

  try {
    const data = await fetchAgentStats();
    cache = { data, fetchedAt: now };
    return Response.json(data);
  } catch (err) {
    // Never return 500 — the home page must render. Serve the previous cache
    // if available, otherwise zeros. Cache the fallback briefly so we don't
    // retry every single request when the RPC is degraded.
    const fallback = cache?.data ?? EMPTY_STATS;
    cache = { data: fallback, fetchedAt: now - (CACHE_TTL_MS - ERROR_CACHE_TTL_MS) };
    return Response.json({
      ...fallback,
      stale: true,
      error: (err as Error).message,
    });
  }
}
