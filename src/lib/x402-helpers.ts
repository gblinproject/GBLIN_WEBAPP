/**
 * GBLIN x402 API — shared helpers
 *
 * Ports the core read-only logic from the GBLIN MCP server (gblinproject/GBLIN-MCP)
 * to a Next.js / Edge-friendly module.
 *
 * Every function is read-only against Base mainnet. No private keys ever touch
 * this code — the API only computes NAV, basket state, slippage, and ready-to-
 * broadcast calldata for the agent's wallet to execute on-chain.
 */

import {
  createPublicClient,
  encodeFunctionData,
  encodePacked,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  type Address,
} from "viem";
import { base } from "viem/chains";

// ─── Network ────────────────────────────────────────────────────────────────
export const BASE_CHAIN_ID = 8453;
const DEFAULT_RPC_URL = "https://base-rpc.publicnode.com";
export const RPC_URL = process.env.GBLIN_RPC_URL ?? DEFAULT_RPC_URL;

// ─── Core Contracts (Base Mainnet, verified) ────────────────────────────────
export const GBLIN_V5: Address = "0x38DcDB3A381677239BBc652aed9811F2f8496345";
export const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const WETH: Address = "0x4200000000000000000000000000000000000006";
export const GBLIN_TIMELOCK: Address = "0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd";
export const ETH_USD_FEED: Address = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
export const EXPECTED_MIN_DELAY_SECONDS = 172_800n;
export const WETH_USDC_POOL_FEE = 500;

// ─── Protocol Constants ─────────────────────────────────────────────────────
export const MIN_DEPOSIT_WEI = 500_000_000_000_000n;
export const COOLDOWN_SECONDS = 120;
export const ORACLE_STALENESS_SECONDS = 86_400;
export const SLIPPAGE_NORMAL_BPS = 250n;
export const SLIPPAGE_CRASH_SHIELD_BPS = 400n;
export const BPS_DENOMINATOR = 10_000n;

// ─── Caching ────────────────────────────────────────────────────────────────
const NAV_CACHE_TTL_MS = 30_000;
const BASKET_CACHE_TTL_MS = 60_000;

// ─── viem client ────────────────────────────────────────────────────────────
export const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL, {
    timeout: 10_000,
    retryCount: 2,
    retryDelay: 500,
  }),
});

// ─── Minimal ABIs (only what the API needs) ─────────────────────────────────
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const CHAINLINK_AGGREGATOR_ABI = [
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

export const GBLIN_ABI = [
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
  {
    name: "quoteSellGBLIN",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gblinAmount", type: "uint256" }],
    outputs: [{ name: "ethOut", type: "uint256" }],
  },
  {
    name: "basket",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "oracle", type: "address" },
      { name: "poolFee", type: "uint24" },
      { name: "isStable", type: "bool" },
      { name: "baseWeight", type: "uint256" },
      { name: "dynamicWeight", type: "uint256" },
      { name: "peakPrice", type: "uint256" },
      { name: "lastPeakUpdate", type: "uint256" },
    ],
  },
  {
    name: "lastDepositTime",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "founderWallet",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "buyGBLIN",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "minGblinOut", type: "uint256" }],
    outputs: [],
  },
  {
    name: "buyGBLINWithToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "path", type: "bytes" },
      { name: "amountIn", type: "uint256" },
      { name: "minWethOut", type: "uint256" },
      { name: "minGblinOut", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "sellGBLINForToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gblinAmount", type: "uint256" },
      { name: "targetToken", type: "address" },
      { name: "wethToTargetFee", type: "uint24" },
      { name: "minTokenOut", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const TIMELOCK_ABI = [
  {
    name: "getMinDelay",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ───────────────────────────────────────────────────────────────────────────
// ETH/USD PRICE (Chainlink) — with staleness guard
// ───────────────────────────────────────────────────────────────────────────

let ethPriceCache: { value: number; fetchedAt: number } | null = null;

export async function getEthPriceUsd(): Promise<number> {
  const now = Date.now();
  if (ethPriceCache && now - ethPriceCache.fetchedAt < NAV_CACHE_TTL_MS) {
    return ethPriceCache.value;
  }

  const data = await client.readContract({
    address: ETH_USD_FEED,
    abi: CHAINLINK_AGGREGATOR_ABI,
    functionName: "latestRoundData",
  });
  const answer = data[1];
  const updatedAt = Number(data[3]);

  if (answer <= 0n) {
    throw new Error("OracleDead: Chainlink ETH/USD feed returned non-positive value.");
  }

  const nowSec = Math.floor(now / 1_000);
  if (nowSec - updatedAt > ORACLE_STALENESS_SECONDS) {
    throw new Error(
      `OracleStale: Chainlink ETH/USD feed is ${nowSec - updatedAt}s old (max ${ORACLE_STALENESS_SECONDS}s).`
    );
  }

  const price = Number(answer) / 1e8;
  ethPriceCache = { value: price, fetchedAt: now };
  return price;
}

// ───────────────────────────────────────────────────────────────────────────
// NAV — net asset value of 1 GBLIN in USD
// ───────────────────────────────────────────────────────────────────────────

let navCache: { value: number; fetchedAt: number } | null = null;

export async function getNavUsd(): Promise<number> {
  const now = Date.now();
  if (navCache && now - navCache.fetchedAt < NAV_CACHE_TTL_MS) {
    return navCache.value;
  }

  const [ethPerGblinWei, ethPriceUsd] = await Promise.all([
    client.readContract({
      address: GBLIN_V5,
      abi: GBLIN_ABI,
      functionName: "quoteSellGBLIN",
      args: [parseUnits("1", 18)],
    }),
    getEthPriceUsd(),
  ]);

  const ethPerGblin = Number(formatUnits(ethPerGblinWei, 18));
  const navUsd = ethPerGblin * ethPriceUsd;
  navCache = { value: navUsd, fetchedAt: now };
  return navUsd;
}

// ───────────────────────────────────────────────────────────────────────────
// BASKET STATE & CRASH SHIELD DETECTION
// ───────────────────────────────────────────────────────────────────────────

export interface BasketEntry {
  token: Address;
  oracle: Address;
  poolFee: number;
  isStable: boolean;
  baseWeightBps: number;
  dynamicWeightBps: number;
  isSlashed: boolean;
}

export interface BasketState {
  entries: BasketEntry[];
  crashShieldActive: boolean;
}

let basketCache: { value: BasketState; fetchedAt: number } | null = null;

export async function getBasketState(): Promise<BasketState> {
  const now = Date.now();
  if (basketCache && now - basketCache.fetchedAt < BASKET_CACHE_TTL_MS) {
    return basketCache.value;
  }

  const entries: BasketEntry[] = [];
  let crashShieldActive = false;

  for (let i = 0; i < 8; i++) {
    try {
      const raw = await client.readContract({
        address: GBLIN_V5,
        abi: GBLIN_ABI,
        functionName: "basket",
        args: [BigInt(i)],
      });
      const [token, oracle, poolFee, isStable, baseWeight, dynamicWeight] = raw;
      const baseBps = Number(baseWeight);
      const dynBps = Number(dynamicWeight);

      if (baseBps === 0 && dynBps === 0) break;

      const isSlashed = dynBps < baseBps;
      if (isSlashed) crashShieldActive = true;

      entries.push({
        token,
        oracle,
        poolFee: Number(poolFee),
        isStable,
        baseWeightBps: baseBps,
        dynamicWeightBps: dynBps,
        isSlashed,
      });
    } catch {
      break;
    }
  }

  const state: BasketState = { entries, crashShieldActive };
  basketCache = { value: state, fetchedAt: now };
  return state;
}

// ───────────────────────────────────────────────────────────────────────────
// DYNAMIC SLIPPAGE
// ───────────────────────────────────────────────────────────────────────────

export interface SlippageProfile {
  bps: bigint;
  pct: number;
  reason: "normal" | "crash_shield_active";
}

export async function getDynamicSlippage(): Promise<SlippageProfile> {
  const basket = await getBasketState();
  if (basket.crashShieldActive) {
    return {
      bps: SLIPPAGE_CRASH_SHIELD_BPS,
      pct: Number(SLIPPAGE_CRASH_SHIELD_BPS) / 100,
      reason: "crash_shield_active",
    };
  }
  return {
    bps: SLIPPAGE_NORMAL_BPS,
    pct: Number(SLIPPAGE_NORMAL_BPS) / 100,
    reason: "normal",
  };
}

export function applySlippageBuffer(expected: bigint, bps: bigint): bigint {
  return (expected * (BPS_DENOMINATOR - bps)) / BPS_DENOMINATOR;
}

// ───────────────────────────────────────────────────────────────────────────
// COOLDOWN CHECK (uses on-chain block timestamp, never Date.now)
// ───────────────────────────────────────────────────────────────────────────

export interface CooldownStatus {
  active: boolean;
  secondsRemaining: number;
  lastDeposit: number;
}

export async function checkCooldown(wallet: Address): Promise<CooldownStatus> {
  const [lastDeposit, block] = await Promise.all([
    client.readContract({
      address: GBLIN_V5,
      abi: GBLIN_ABI,
      functionName: "lastDepositTime",
      args: [wallet],
    }),
    client.getBlock(),
  ]);

  const lastDepositNum = Number(lastDeposit);
  const nowOnChain = Number(block.timestamp);
  const unlockAt = lastDepositNum + COOLDOWN_SECONDS;

  if (nowOnChain < unlockAt) {
    return {
      active: true,
      secondsRemaining: unlockAt - nowOnChain,
      lastDeposit: lastDepositNum,
    };
  }
  return { active: false, secondsRemaining: 0, lastDeposit: lastDepositNum };
}

// ───────────────────────────────────────────────────────────────────────────
// REVERSE QUOTE — USDC → GBLIN to sell
// ───────────────────────────────────────────────────────────────────────────

export async function quoteGblinForUsdc(usdcTargetStr: string): Promise<{
  gblinToSell: bigint;
  minUsdcOut: bigint;
  expectedUsdcOut: bigint;
  navUsd: number;
  slippage: SlippageProfile;
}> {
  const navUsd = await getNavUsd();
  const slippage = await getDynamicSlippage();

  const usdcTargetUnits = parseUnits(usdcTargetStr, 6);
  const grossUsdcTarget =
    (usdcTargetUnits * BPS_DENOMINATOR) / (BPS_DENOMINATOR - slippage.bps);

  const navUsdScaled = BigInt(Math.round(navUsd * 1_000_000));
  const gblinToSell = (grossUsdcTarget * parseUnits("1", 18)) / navUsdScaled;

  return {
    gblinToSell,
    minUsdcOut: usdcTargetUnits,
    expectedUsdcOut: grossUsdcTarget,
    navUsd,
    slippage,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// JIT CALLDATA — sellGBLINForToken (single atomic tx)
// ───────────────────────────────────────────────────────────────────────────

export function buildJitCalldata(
  gblinToSell: bigint,
  minUsdcOut: bigint
): `0x${string}` {
  return encodeFunctionData({
    abi: GBLIN_ABI,
    functionName: "sellGBLINForToken",
    args: [gblinToSell, USDC, WETH_USDC_POOL_FEE, minUsdcOut],
  });
}

// ───────────────────────────────────────────────────────────────────────────
// INVEST CALLDATA — USDC → GBLIN (2 sequential txs: approve + buy)
// ───────────────────────────────────────────────────────────────────────────

export async function buildInvestCalldata(usdcAmountStr: string): Promise<{
  approveCalldata: `0x${string}`;
  buyCalldata: `0x${string}`;
  expectedGblinOut: string;
  minGblinOut: string;
  minWethOut: string;
}> {
  const usdcUnits = parseUnits(usdcAmountStr, 6);
  if (usdcUnits === 0n) throw new Error("usdc_amount must be > 0");

  const [ethPriceUsd, slippage] = await Promise.all([
    getEthPriceUsd(),
    getDynamicSlippage(),
  ]);

  const ethPriceScaled = BigInt(Math.round(ethPriceUsd * 1_000_000));
  const wethExpected = (usdcUnits * parseUnits("1", 18)) / ethPriceScaled;
  const minWethOut = applySlippageBuffer(wethExpected, slippage.bps);

  if (minWethOut < MIN_DEPOSIT_WEI) {
    throw new Error(
      `DepositTooSmall: ~${formatUnits(wethExpected, 18)} WETH below min ${formatUnits(MIN_DEPOSIT_WEI, 18)} ETH.`
    );
  }

  const [gblinExpected] = await client.readContract({
    address: GBLIN_V5,
    abi: GBLIN_ABI,
    functionName: "quoteBuyGBLIN",
    args: [minWethOut],
  });
  const minGblinOut = applySlippageBuffer(gblinExpected, slippage.bps);

  const path = encodePacked(
    ["address", "uint24", "address"],
    [USDC, WETH_USDC_POOL_FEE, WETH]
  );

  const approveCalldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [GBLIN_V5, usdcUnits],
  });

  const buyCalldata = encodeFunctionData({
    abi: GBLIN_ABI,
    functionName: "buyGBLINWithToken",
    args: [path, usdcUnits, minWethOut, minGblinOut],
  });

  return {
    approveCalldata,
    buyCalldata,
    expectedGblinOut: formatUnits(gblinExpected, 18),
    minGblinOut: formatUnits(minGblinOut, 18),
    minWethOut: formatUnits(minWethOut, 18),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// WALLET BALANCES (for /health)
// ───────────────────────────────────────────────────────────────────────────

export interface WalletBalances {
  gblinFormatted: string;
  gblinValueUsd: number;
  usdcFormatted: string;
  ethFormatted: string;
  ethValueUsd: number;
  totalUsd: number;
}

export async function getWalletBalances(wallet: Address): Promise<WalletBalances> {
  const [gblin, usdc, eth, navUsd, ethPriceUsd] = await Promise.all([
    client.readContract({
      address: GBLIN_V5,
      abi: GBLIN_ABI,
      functionName: "balanceOf",
      args: [wallet],
    }),
    client.readContract({
      address: USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [wallet],
    }),
    client.getBalance({ address: wallet }),
    getNavUsd(),
    getEthPriceUsd(),
  ]);

  const gblinFormatted = formatUnits(gblin, 18);
  const usdcFormatted = formatUnits(usdc, 6);
  const ethFormatted = formatUnits(eth, 18);

  const gblinValueUsd = Number(gblinFormatted) * navUsd;
  const ethValueUsd = Number(ethFormatted) * ethPriceUsd;
  const totalUsd = gblinValueUsd + Number(usdcFormatted) + ethValueUsd;

  return {
    gblinFormatted,
    gblinValueUsd,
    usdcFormatted,
    ethFormatted,
    ethValueUsd,
    totalUsd,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// JSON-safe BigInt serialization
// ───────────────────────────────────────────────────────────────────────────

export function toJson<T>(payload: T): string {
  return JSON.stringify(
    payload,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  );
}

export function jsonResponse<T>(payload: T, status = 200): Response {
  return new Response(toJson(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Address validator (returns checksummed Address or throws)
// ───────────────────────────────────────────────────────────────────────────

export function parseWallet(value: string | null): Address {
  if (!value) throw new Error("Missing required parameter: wallet");
  try {
    return getAddress(value);
  } catch {
    throw new Error(`Invalid EVM address: ${value}`);
  }
}
