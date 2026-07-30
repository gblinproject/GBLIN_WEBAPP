/**
 * GET /api/mint-vs-pool
 *
 * Answers one question with live on-chain data: for a given purchase size,
 * what does one GBLIN cost if you mint it from the contract, versus what it
 * costs if you swap for it in the deepest DEX pool?
 *
 * Minting quotes come straight from `quoteBuyGBLIN(uint256)` on the token
 * contract — the contract issues new supply against the deposit, so the price
 * per token is the same at any size.
 *
 * The pool leg uses the Aerodrome vAMM pool, which is the deeper of the two
 * (Uniswap V3 holds roughly a third of the same reserves), so the comparison
 * is against the friendlier of the two swap routes, not the worse one. The
 * constant-product math with the 0.30% vAMM fee is reproduced here rather than
 * routed through the router, so the numbers stay verifiable from reserves.
 *
 * Cache: 5 minutes in-memory. Everything here is a read; no keys required.
 */

import { formatEther, parseEther } from "viem";
import type { Address } from "viem";
import { client, ETH_USD_FEED, GBLIN } from "@/lib/x402-helpers";

export const runtime = "nodejs";

const AERODROME_POOL: Address = "0x6Ac18D5e90278D2477027B5769EFb2fF0711FFbB";

/** Purchase sizes shown in the table, in US dollars. */
const SIZES_USD = [25, 100, 500, 2_000];

/** Aerodrome volatile pools charge 0.30% on the input amount. */
const AERO_FEE_BPS = 30n;

const QUOTE_ABI = [
  {
    name: "quoteBuyGBLIN",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "ethAmount", type: "uint256" }],
    outputs: [
      { name: "gblinOut", type: "uint256" },
      { name: "founderFee", type: "uint256" },
      { name: "stabilityFee", type: "uint256" },
    ],
  },
] as const;

const POOL_ABI = [
  {
    name: "getReserves",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_reserve0", type: "uint256" },
      { name: "_reserve1", type: "uint256" },
      { name: "_blockTimestampLast", type: "uint256" },
    ],
  },
  {
    name: "token0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

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

export interface MintVsPoolRow {
  /** Purchase size in US dollars. */
  usd: number;
  /** Price of one GBLIN when minting from the contract, in US dollars. */
  mintUsd: number;
  /** Effective price of one GBLIN when swapping in the pool, in US dollars. */
  poolUsd: number;
  /** How much more the pool route costs, in percent of the mint price. */
  extraPct: number;
}

export interface MintVsPoolPayload {
  ethUsd: number;
  mintUsd: number;
  poolLiquidityUsd: number;
  rows: MintVsPoolRow[];
  updatedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1_000;
let cache: { at: number; payload: MintVsPoolPayload } | null = null;

/** Constant-product output for a vAMM swap, mirroring Aerodrome's `_getAmountOut`. */
function ammOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  const afterFee = amountIn - (amountIn * AERO_FEE_BPS) / 10_000n;
  return (afterFee * reserveOut) / (reserveIn + afterFee);
}

async function build(): Promise<MintVsPoolPayload> {
  const [feed, reserves, token0] = await Promise.all([
    client.readContract({
      address: ETH_USD_FEED,
      abi: FEED_ABI,
      functionName: "latestRoundData",
    }),
    client.readContract({
      address: AERODROME_POOL,
      abi: POOL_ABI,
      functionName: "getReserves",
    }),
    client.readContract({
      address: AERODROME_POOL,
      abi: POOL_ABI,
      functionName: "token0",
    }),
  ]);

  const ethUsd = Number(feed[1]) / 1e8;
  if (!Number.isFinite(ethUsd) || ethUsd <= 0) {
    throw new Error("ETH/USD feed returned a non-positive answer");
  }

  const gblinIsToken0 =
    token0.toLowerCase() === GBLIN.toLowerCase();
  const reserveGblin = gblinIsToken0 ? reserves[0] : reserves[1];
  const reserveWeth = gblinIsToken0 ? reserves[1] : reserves[0];

  // Both sides of a balanced pool are worth the same, so total depth is the
  // WETH leg doubled.
  const poolLiquidityUsd = Number(formatEther(reserveWeth)) * ethUsd * 2;

  const rows: MintVsPoolRow[] = [];
  let mintUsd = 0;

  for (const usd of SIZES_USD) {
    const ethIn = parseEther((usd / ethUsd).toFixed(18));

    const [gblinOut] = await client.readContract({
      address: GBLIN,
      abi: QUOTE_ABI,
      functionName: "quoteBuyGBLIN",
      args: [ethIn],
    });

    const mintedTokens = Number(formatEther(gblinOut));
    const poolTokens = Number(
      formatEther(ammOut(ethIn, reserveWeth, reserveGblin)),
    );
    if (mintedTokens <= 0 || poolTokens <= 0) continue;

    const rowMintUsd = usd / mintedTokens;
    const rowPoolUsd = usd / poolTokens;
    mintUsd = rowMintUsd;

    rows.push({
      usd,
      mintUsd: rowMintUsd,
      poolUsd: rowPoolUsd,
      extraPct: ((rowPoolUsd - rowMintUsd) / rowMintUsd) * 100,
    });
  }

  if (rows.length === 0) throw new Error("no quotes returned");

  return {
    ethUsd,
    mintUsd,
    poolLiquidityUsd,
    rows,
    updatedAt: Date.now(),
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return Response.json(cache.payload, {
      headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  }

  try {
    const payload = await build();
    cache = { at: Date.now(), payload };
    return Response.json(payload, {
      headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    // A stale answer beats an empty section; the client hides it if neither exists.
    if (cache) {
      return Response.json(cache.payload, {
        headers: { "cache-control": "public, s-maxage=60" },
      });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "unavailable" },
      { status: 503 },
    );
  }
}
