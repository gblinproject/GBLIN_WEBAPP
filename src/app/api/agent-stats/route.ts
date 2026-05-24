/**
 * GET /api/agent-stats
 *
 * Reads on-chain USDC Transfer events to the x402 fee wallet on Base mainnet
 * and returns KPI counters for the "AI Agents" section on the home page.
 *
 * Filter mirrors the Dune query (id: 7564984):
 *   contract_address = USDC on Base
 *   to               = 0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B  (fee wallet)
 *   from            != zero address
 *
 * Cache: 5 minutes in-memory to avoid hammering the RPC.
 */

import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { base } from "viem/chains";

export const runtime = "nodejs";
export const maxDuration = 30;

const RPC_URL =
  process.env.GBLIN_RPC_URL ?? "https://base-rpc.publicnode.com";

const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const FEE_WALLET: Address = "0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B";
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL, { timeout: 15_000, retryCount: 2, retryDelay: 500 }),
});

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

// Base mainnet block time is ~2s. Default lookback ~= 14 days, which covers
// the entire x402 fee history (fee wallet first used around May 18 2026).
// Override via env GBLIN_STATS_LOOKBACK_BLOCKS to extend the window.
const DEFAULT_LOOKBACK_BLOCKS = 600_000n;
const LOOKBACK_BLOCKS = process.env.GBLIN_STATS_LOOKBACK_BLOCKS
  ? BigInt(process.env.GBLIN_STATS_LOOKBACK_BLOCKS)
  : DEFAULT_LOOKBACK_BLOCKS;

// publicnode.com Base allows up to ~50k blocks per getLogs call.
const CHUNK = 45_000n;
// Number of chunks to request in parallel.
const CONCURRENCY = 4;

async function fetchAgentStats(): Promise<AgentStats> {
  const latestBlock = await client.getBlockNumber();
  const startBlock =
    latestBlock > LOOKBACK_BLOCKS ? latestBlock - LOOKBACK_BLOCKS : 0n;

  // Build the list of [from,to] ranges first.
  const ranges: Array<[bigint, bigint]> = [];
  for (let f = startBlock; f <= latestBlock; f += CHUNK) {
    const t = f + CHUNK - 1n < latestBlock ? f + CHUNK - 1n : latestBlock;
    ranges.push([f, t]);
  }

  const uniqueAgents = new Set<string>();
  let totalCalls = 0;
  let totalUsdc = 0n;

  // Process in parallel batches to stay under RPC rate limits.
  for (let i = 0; i < ranges.length; i += CONCURRENCY) {
    const batch = ranges.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(([fromBlock, toBlock]) =>
        client.getLogs({
          address: USDC,
          event: TRANSFER_EVENT,
          args: { to: FEE_WALLET },
          fromBlock,
          toBlock,
        })
      )
    );

    for (const logs of results) {
      for (const log of logs) {
        const from = log.args.from as Address | undefined;
        if (!from || from.toLowerCase() === ZERO_ADDRESS.toLowerCase())
          continue;
        uniqueAgents.add(from.toLowerCase());
        totalCalls += 1;
        totalUsdc += log.args.value ?? 0n;
      }
    }
  }

  return {
    total_paid_calls: totalCalls,
    total_unique_agents: uniqueAgents.size,
    total_usdc_earned: Number(totalUsdc) / 1e6,
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
