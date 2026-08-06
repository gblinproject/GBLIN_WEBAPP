/**
 * GET /api/nav-fees
 *
 * Answers: how much of the fee paid by buyers has stayed in the reserves and
 * lifted the NAV for every holder?
 *
 * The contract splits its 0.10% mint fee in two halves. The founder half leaves
 * the vault. The stability half is handled by `_splitFee`: a slice tops up the
 * keeper bounty buffer (`stabilityFund`, which is explicitly excluded from
 * redeemable reserves), and whatever is left over simply stays in the vault as
 * holder-owned WETH. That leftover is announced by `YieldDistributed(uint256)`
 * and is the only honest measure of "fees that became NAV".
 *
 * Note for anyone reading the numbers: `stabilityFund` is NOT this figure —
 * it is the keeper buffer, and it belongs to future keepers, not to holders.
 *
 * Logs come from Blockscout, which serves the whole history in a single call.
 * There is deliberately no eth_getLogs fallback: every public Base RPC caps a
 * log query at 10k blocks or less, so covering the contract's life would take
 * ~200 sequential calls per request — too slow, and too expensive in function
 * CPU. When Blockscout is unavailable we serve the last good figure, or none
 * at all. A number this page publishes must never be a synthesised zero: an
 * incomplete scan is reported as an outage, not as "no fees yet".
 *
 * Cache: 15 minutes in memory, plus the platform fetch cache, so the upstream
 * sees roughly one request per window regardless of traffic.
 */

import { formatEther } from "viem";
import { client, ETH_USD_FEED, GBLIN } from "@/lib/x402-helpers";

export const runtime = "nodejs";

/** keccak256("YieldDistributed(uint256)") */
const YIELD_TOPIC =
  "0xe8ed0a697f15301f06fd3d30bc896682e7826c5397076a3eda05844cfc356480";

const BLOCKSCOUT_URL = "https://base.blockscout.com/api";

/** Block the production contract was deployed in (Base, 21 June 2026). */
const DEPLOY_BLOCK = 47_600_000n;

const FEED_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export interface NavFeesPayload {
  /** Fees that stayed in the reserves, in WETH. */
  weth: number;
  /** The same amount in US dollars, at the current Chainlink ETH/USD price. */
  usd: number;
  /** How many times the contract has distributed a fee into the reserves. */
  events: number;
  ethUsd: number;
  updatedAt: number;
}

const CACHE_TTL_MS = 15 * 60 * 1_000;
let cache: { at: number; payload: NavFeesPayload } | null = null;

/**
 * Full history in one request.
 *
 * Throws rather than returning zero when the upstream refuses (rate limit,
 * outage, malformed answer): the caller must be able to tell "nothing was
 * distributed" apart from "we could not read the chain".
 */
async function sumViaBlockscout(): Promise<{ total: bigint; events: number }> {
  const url =
    `${BLOCKSCOUT_URL}?module=logs&action=getLogs` +
    `&fromBlock=${DEPLOY_BLOCK}&toBlock=latest&address=${GBLIN}&topic0=${YIELD_TOPIC}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`log source answered HTTP ${res.status}`);

  const body = (await res.json()) as { status?: string; message?: string; result?: unknown };
  if (!Array.isArray(body.result)) {
    // status "0" carries a reason: "Too many requests", "No records found", …
    throw new Error(body.message ?? "log source returned no usable result");
  }

  const logs = body.result as Array<{ data?: string }>;
  let total = 0n;
  for (const log of logs) {
    if (typeof log.data === "string" && log.data !== "0x") {
      total += BigInt(log.data);
    }
  }
  return { total, events: logs.length };
}

async function build(): Promise<NavFeesPayload> {
  const [feed, sum] = await Promise.all([
    client.readContract({
      address: ETH_USD_FEED,
      abi: FEED_ABI,
      functionName: "latestRoundData",
    }),
    sumViaBlockscout(),
  ]);

  const ethUsd = Number(feed[1]) / 1e8;
  if (!Number.isFinite(ethUsd) || ethUsd <= 0) {
    throw new Error("ETH/USD feed returned a non-positive answer");
  }

  const weth = Number(formatEther(sum.total));

  return {
    weth,
    usd: weth * ethUsd,
    events: sum.events,
    ethUsd,
    updatedAt: Date.now(),
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return Response.json(cache.payload, {
      headers: { "Cache-Control": "public, max-age=900, s-maxage=900" },
    });
  }

  try {
    const payload = await build();
    cache = { at: Date.now(), payload };
    return Response.json(payload, {
      headers: { "Cache-Control": "public, max-age=900, s-maxage=900" },
    });
  } catch (error) {
    // Serve a stale payload rather than nothing: the figure is slow-moving.
    if (cache) {
      return Response.json(cache.payload, {
        headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
      });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "unavailable" },
      { status: 503 },
    );
  }
}
