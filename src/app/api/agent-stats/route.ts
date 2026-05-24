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

// Base mainnet block time is ~2s, so:
//   1 day  ≈  43_200 blocks
//   90 days ≈ 3_888_000 blocks
// The x402 fee wallet was first used around May 18 2026 — scanning 90 days
// of history is generous and keeps RPC load bounded.
const DEFAULT_LOOKBACK_BLOCKS = 4_000_000n;
const LOOKBACK_BLOCKS = process.env.GBLIN_STATS_LOOKBACK_BLOCKS
  ? BigInt(process.env.GBLIN_STATS_LOOKBACK_BLOCKS)
  : DEFAULT_LOOKBACK_BLOCKS;

// Most public Base RPCs cap getLogs at ~10k blocks per request.
const CHUNK = 9_500n;

async function fetchAgentStats(): Promise<AgentStats> {
  const latestBlock = await client.getBlockNumber();
  const startBlock =
    latestBlock > LOOKBACK_BLOCKS ? latestBlock - LOOKBACK_BLOCKS : 0n;

  const uniqueAgents = new Set<string>();
  let totalCalls = 0;
  let totalUsdc = 0n;

  let fromBlock = startBlock;
  while (fromBlock <= latestBlock) {
    const toBlock =
      fromBlock + CHUNK - 1n < latestBlock
        ? fromBlock + CHUNK - 1n
        : latestBlock;

    const logs = await client.getLogs({
      address: USDC,
      event: TRANSFER_EVENT,
      args: { to: FEE_WALLET },
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      const from = log.args.from as Address | undefined;
      if (!from || from.toLowerCase() === ZERO_ADDRESS.toLowerCase()) continue;
      uniqueAgents.add(from.toLowerCase());
      totalCalls += 1;
      totalUsdc += log.args.value ?? 0n;
    }

    fromBlock = toBlock + 1n;
  }

  return {
    total_paid_calls: totalCalls,
    total_unique_agents: uniqueAgents.size,
    total_usdc_earned: Number(totalUsdc) / 1e6,
  };
}

export async function GET(): Promise<Response> {
  try {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      return Response.json(cache.data);
    }

    const data = await fetchAgentStats();
    cache = { data, fetchedAt: now };
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
