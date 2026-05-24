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
 * Implementation: paginated calls to Moralis `/erc20/transfers` filtered by
 * the x402 fee wallet. Moralis is already configured for the rest of the
 * app (see protocol-data.ts).
 *
 * Cache: 5 minutes in-memory.
 */

export const runtime = "nodejs";

// Re-uses the existing Moralis key. The client-side var name is kept for
// compatibility, but server code can also read it from MORALIS_API_KEY.
const MORALIS_API_KEY =
  process.env.MORALIS_API_KEY ?? process.env.NEXT_PUBLIC_MORALIS_API_KEY ?? "";
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

interface MoralisErc20Transfer {
  from_address: string;
  to_address: string;
  value: string;
  address: string; // token contract
}

interface MoralisErc20TransfersResponse {
  cursor: string | null;
  page: number;
  page_size: number;
  result: MoralisErc20Transfer[];
}

// Cap how many pages we fetch so the function always completes within the
// Vercel Hobby 10s budget. 5 pages × 100 transfers = 500 rows — far more
// than the current x402 volume.
const MAX_PAGES = 5;
const PAGE_SIZE = 100;

async function fetchAgentStats(): Promise<AgentStats> {
  if (!MORALIS_API_KEY) {
    throw new Error(
      "MORALIS_API_KEY env var is required (set NEXT_PUBLIC_MORALIS_API_KEY)"
    );
  }

  const uniqueAgents = new Set<string>();
  let totalCalls = 0;
  let totalUsdcMicro = 0n;

  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(
      `https://deep-index.moralis.io/api/v2.2/${FEE_WALLET}/erc20/transfers`
    );
    url.searchParams.set("chain", "base");
    url.searchParams.set("contract_addresses", USDC);
    url.searchParams.set("order", "DESC");
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        "X-API-Key": MORALIS_API_KEY,
      },
      signal: AbortSignal.timeout(7_000),
    });
    if (!res.ok) {
      throw new Error(`Moralis HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as MoralisErc20TransfersResponse;
    const rows = json.result ?? [];

    for (const row of rows) {
      const from = row.from_address?.toLowerCase();
      const to = row.to_address?.toLowerCase();
      if (!from || !to) continue;
      if (to !== FEE_WALLET.toLowerCase()) continue; // only inbound
      if (from === ZERO_ADDRESS.toLowerCase()) continue;
      uniqueAgents.add(from);
      totalCalls += 1;
      try {
        totalUsdcMicro += BigInt(row.value);
      } catch {
        // skip malformed value
      }
    }

    if (!json.cursor || rows.length < PAGE_SIZE) break;
    cursor = json.cursor;
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
