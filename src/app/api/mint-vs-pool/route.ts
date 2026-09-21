/**
 * GET /api/mint-vs-pool
 *
 * Answers one question with live on-chain data: for a given purchase size,
 * what does one GBLIN cost if you mint it from the contract, versus what it
 * costs if you swap for it in the deepest DEX pool?
 *
 * Minting quotes come from the Lens, which prices a mint exactly as the vault
 * does — the vault issues new supply against the deposit, so the price per
 * share is the same at any size.
 *
 * The pool leg needs a pool. The vault in service has no secondary market: the
 * way in and out is minting and redeeming at NAV. Until a pool exists, this
 * endpoint says so and returns no rows, and the comparison on the page hides
 * itself rather than invent a second price. Point `COMPARISON_POOL` at a pool
 * to turn it back on; the constant-product math with the 0.30% vAMM fee is
 * reproduced here rather than routed through a router, so the numbers stay
 * verifiable from the reserves.
 *
 * Cache: 5 minutes in-memory. Everything here is a read; no keys required.
 */

import { formatEther, parseEther } from "viem";
import type { Address } from "viem";
import { client, ETH_USD_FEED, GBLIN, GBLIN_LENS } from "@/lib/x402-helpers";

export const runtime = "nodejs";

/** The pool to compare against, or null while the vault has no secondary market. */
const COMPARISON_POOL: Address | null = null;

/** Purchase sizes shown in the table, in US dollars. */
const SIZES_USD = [25, 100, 500, 2_000];

/** Aerodrome volatile pools charge 0.30% on the input amount. */
const AERO_FEE_BPS = 30n;

const QUOTE_ABI = [
  {
    name: "quoteBuy",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "vault", type: "address" },
      { name: "ethValue", type: "uint256" },
    ],
    outputs: [
      { name: "out", type: "uint256" },
      { name: "protocolFee", type: "uint256" },
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
  // No pool, no comparison. An empty `rows` is what the page checks before it renders anything, so it
  // simply does not draw a table rather than show one side of a two-sided claim.
  if (COMPARISON_POOL === null) {
    const feedOnly = await client.readContract({
      address: ETH_USD_FEED,
      abi: FEED_ABI,
      functionName: "latestRoundData",
    });
    const ethUsdNow = Number(feedOnly[1]) / 1e8;
    const [sharesPerEth] = await client.readContract({
      address: GBLIN_LENS,
      abi: QUOTE_ABI,
      functionName: "quoteBuy",
      args: [GBLIN, parseEther("1")],
    });
    const mintUsdNow =
      sharesPerEth > 0n ? ethUsdNow / Number(formatEther(sharesPerEth)) : 0;
    return {
      ethUsd: ethUsdNow,
      mintUsd: mintUsdNow,
      poolLiquidityUsd: 0,
      rows: [],
      updatedAt: Date.now(),
    };
  }

  const [feed, reserves, token0] = await Promise.all([
    client.readContract({
      address: ETH_USD_FEED,
      abi: FEED_ABI,
      functionName: "latestRoundData",
    }),
    client.readContract({
      address: COMPARISON_POOL,
      abi: POOL_ABI,
      functionName: "getReserves",
    }),
    client.readContract({
      address: COMPARISON_POOL,
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
      address: GBLIN_LENS,
      abi: QUOTE_ABI,
      functionName: "quoteBuy",
      args: [GBLIN, ethIn],
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
