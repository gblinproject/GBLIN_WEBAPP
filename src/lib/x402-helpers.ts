/**
 * GBLIN x402 API — shared helpers
 *
 * Ports the core read-only logic from the GBLIN MCP server (gblinproject/gblin-treasury-risk-regime)
 * to a Next.js / Edge-friendly module.
 *
 * Every function is read-only against Base mainnet. No private keys ever touch
 * this code — the API only computes NAV, basket state, slippage, and ready-to-
 * broadcast calldata for the agent's wallet to execute on-chain.
 */

import { withBuilderSuffix } from "./builder-code";
import {
  createPublicClient,
  encodeAbiParameters,
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
// The single production GBLIN contract on Base. Deliberately unversioned:
// agents consume an address, not a release number, and the old versioned name
// is what let a stale "v5" label leak into the public governance response.
export const GBLIN: Address = "0xc2181d975c05c8c724b334bcED0764c0b86B1D53";
export const GBLIN_LENS: Address = "0xfCFea8027019E8551A1f09AD91532471F5D26f61";
export const GBLIN_ZAP: Address = "0x0E9D6Ceb6D313b021622C121Cda9C62e86e60200";
// Routing data the Zap hands to its swap adapter: the Uniswap V3 fee tier of the pair, ABI-encoded.
export const VENUE_FEE_500 = encodeAbiParameters([{ type: "uint24" }], [500]);
export const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const WETH: Address = "0x4200000000000000000000000000000000000006";
export const GBLIN_TIMELOCK: Address = "0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd";
export const ETH_USD_FEED: Address = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
export const EXPECTED_MIN_DELAY_SECONDS = 172_800n;
export const WETH_USDC_POOL_FEE = 500;
export const SWAP_ROUTER_02: Address = "0x2626664c2603336E57B271c5C0b26F421741e481";

// ─── Protocol Constants ─────────────────────────────────────────────────────
// The minimum deposit and the redemption cooldown are vault parameters that governance can change:
// they are read live through the Lens (readProtocolLimits), never hard-coded here.
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

export const SWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export const GBLIN_ABI = [
  {
    name: "totalEthValue",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "excludeWeth", type: "uint256" }],
    outputs: [{ name: "total", type: "uint256" }],
  },
  {
    name: "navPerShare",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "excludeWeth", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isNavReliable",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "auctionPremiumBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    name: "owner",
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
    inputs: [{ name: "minOut", type: "uint256" }],
    outputs: [],
  },
  {
    name: "buyGBLINWithWeth",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "minOut", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "buyGBLINInKind",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "sellGBLIN",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "gblinAmount", type: "uint256" }],
    outputs: [],
  },
] as const;

// The Lens answers everything the vault does not expose directly: quotes, configuration, basket rows
// and auction state. Every call takes the vault as its first argument.
export const LENS_ABI = [
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
  {
    name: "quoteSell",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "vault", type: "address" },
      { name: "gblinAmount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "basketLength",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "asset",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "vault", type: "address" },
      { name: "i", type: "uint256" },
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "oracle", type: "address" },
      { name: "isStable", type: "bool" },
      { name: "delisted", type: "bool" },
      { name: "baseWeight", type: "uint256" },
      { name: "dynamicWeight", type: "uint256" },
      { name: "shielded", type: "bool" },
      { name: "abandoned", type: "bool" },
    ],
  },
  {
    name: "auction",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "vault", type: "address" },
      { name: "i", type: "uint256" },
    ],
    outputs: [
      { name: "open", type: "bool" },
      { name: "premiumBps", type: "int256" },
      { name: "vaultBuysAsset", type: "bool" },
      { name: "gapEth", type: "uint256" },
    ],
  },
  {
    name: "configFees",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [
      { name: "protocolFee", type: "uint256" },
      { name: "stabilityFee", type: "uint256" },
      { name: "minDeposit", type: "uint256" },
      { name: "oracleAge", type: "uint256" },
      { name: "oracleAgeTrade", type: "uint256" },
      { name: "sellCooldown", type: "uint256" },
      { name: "basketCap", type: "uint256" },
    ],
  },
  {
    name: "lastDepositTime",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "vault", type: "address" },
      { name: "holder", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "feeRecipient",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

// The Zap is the only contract that swaps: it mints with any token and exits to ETH by redeeming in
// kind on the vault and selling the legs.
export const ZAP_ABI = [
  {
    name: "buyGBLINWithToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minWethOut", type: "uint256" },
      { name: "minOut", type: "uint256" },
      { name: "venueData", type: "bytes" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "out", type: "uint256" }],
  },
  {
    name: "sellGBLINForEth",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "minEthOut", type: "uint256" },
      { name: "venueData", type: "bytes[]" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "ethOut", type: "uint256" }],
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
      address: GBLIN_LENS,
      abi: LENS_ABI,
      functionName: "quoteSell",
      args: [GBLIN, parseUnits("1", 18)],
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
  isStable: boolean;
  baseWeightBps: number;
  dynamicWeightBps: number;
  /** True while the crash shield is cutting this row's weight. */
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

  const rowCount = await client
    .readContract({ address: GBLIN_LENS, abi: LENS_ABI, functionName: "basketLength", args: [GBLIN] })
    .catch(() => 0n);

  for (let i = 0; i < Number(rowCount); i++) {
    try {
      const raw = await client.readContract({
        address: GBLIN_LENS,
        abi: LENS_ABI,
        functionName: "asset",
        args: [GBLIN, BigInt(i)],
      });
      const [token, oracle, isStable, , baseWeight, dynamicWeight, shielded] = raw;
      const baseBps = Number(baseWeight);
      const dynBps = Number(dynamicWeight);

      // The shield's own flag, not a comparison: a row can keep its weight and still be shielded.
      if (shielded) crashShieldActive = true;

      entries.push({
        token,
        oracle,
        isStable,
        baseWeightBps: baseBps,
        dynamicWeightBps: dynBps,
        isSlashed: Boolean(shielded),
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

// ───────────────────────────────────────────────────────────────────────────
// PROTOCOL LIMITS — minimum deposit and redemption cooldown, read live
// ───────────────────────────────────────────────────────────────────────────

export interface ProtocolLimits {
  minDepositWei: bigint;
  sellCooldownSeconds: number;
}

let limitsCache: { value: ProtocolLimits; at: number } | null = null;
const LIMITS_CACHE_TTL_MS = 300_000;

export async function readProtocolLimits(): Promise<ProtocolLimits> {
  if (limitsCache && Date.now() - limitsCache.at < LIMITS_CACHE_TTL_MS) return limitsCache.value;
  const r = await client.readContract({
    address: GBLIN_LENS,
    abi: LENS_ABI,
    functionName: "configFees",
    args: [GBLIN],
  });
  const value = { minDepositWei: r[2], sellCooldownSeconds: Number(r[5]) };
  limitsCache = { value, at: Date.now() };
  return value;
}

export async function checkCooldown(wallet: Address): Promise<CooldownStatus> {
  const [lastDeposit, block, limits] = await Promise.all([
    client.readContract({
      address: GBLIN_LENS,
      abi: LENS_ABI,
      functionName: "lastDepositTime",
      args: [GBLIN, wallet],
    }),
    client.getBlock(),
    readProtocolLimits(),
  ]);

  const lastDepositNum = Number(lastDeposit);
  const nowOnChain = Number(block.timestamp);
  const unlockAt = lastDepositNum + limits.sellCooldownSeconds;

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
  // The buffer is applied twice downstream: once to the Zap exit's minimum ETH, once to the WETH->USDC
  // swap, which spends only that minimum and must still return the full target. Gross up for both.
  const keep = BPS_DENOMINATOR - slippage.bps;
  const grossUsdcTarget =
    (usdcTargetUnits * BPS_DENOMINATOR * BPS_DENOMINATOR) / (keep * keep);

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

export interface JitStep {
  step: number;
  description: string;
  target: Address;
  calldata: `0x${string}`;
  value: string;
}

// The vault redeems in kind and never swaps, so GBLIN -> USDC is three steps:
//   1) approve the shares to the Zap (it pulls them);
//   2) the Zap's sellGBLINForEth: redeem in kind on the vault, sell every leg, deliver ETH — all or
//      nothing, so a leg that cannot be sold reverts the whole step instead of paying out less;
//   3) Uniswap exactInputSingle WETH->USDC, paid with the received ETH.
// Step 3's amountIn is minEthOut (the guaranteed minimum of step 2), so it can never ask for more ETH
// than step 2 delivered. Every leg carries a minimum: no sandwich surface.
export async function buildJitCalldata(
  gblinToSell: bigint,
  minUsdcOut: bigint,
  slippageBps: bigint,
  wallet: Address
): Promise<{ steps: JitStep[]; minEthOut: bigint }> {
  const ethExpected = (await client.readContract({
    address: GBLIN_LENS,
    abi: LENS_ABI,
    functionName: "quoteSell",
    args: [GBLIN, gblinToSell],
  })) as bigint;
  const minEthOut = applySlippageBuffer(ethExpected, slippageBps);

  const rowCount = Number(
    await client
      .readContract({ address: GBLIN_LENS, abi: LENS_ABI, functionName: "basketLength", args: [GBLIN] })
      .catch(() => 3n)
  );
  const approveCalldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [GBLIN_ZAP, gblinToSell],
  });
  const sellCalldata = encodeFunctionData({
    abi: ZAP_ABI,
    functionName: "sellGBLINForEth",
    // One routing entry per basket row, index for index; WETH and abandoned rows ignore theirs.
    args: [gblinToSell, minEthOut, Array.from({ length: rowCount }, () => VENUE_FEE_500), wallet],
  });
  const swapCalldata = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: WETH,
        tokenOut: USDC,
        fee: WETH_USDC_POOL_FEE,
        recipient: wallet,
        amountIn: minEthOut,
        amountOutMinimum: minUsdcOut,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  return {
    minEthOut,
    steps: [
      { step: 1, description: "Approve the shares to the GBLIN Zap", target: GBLIN, calldata: withBuilderSuffix(approveCalldata), value: "0" },
      { step: 2, description: "Redeem in kind and sell the legs for ETH through the Zap (all or nothing)", target: GBLIN_ZAP, calldata: withBuilderSuffix(sellCalldata), value: "0" },
      { step: 3, description: "Swap the received ETH to USDC via Uniswap V3 (WETH->USDC)", target: SWAP_ROUTER_02, calldata: withBuilderSuffix(swapCalldata), value: minEthOut.toString() },
    ],
  };
}

// ───────────────────────────────────────────────────────────────────────────
// INVEST CALLDATA — USDC → GBLIN (4 sequential txs: bypass broken exactInput)
// ───────────────────────────────────────────────────────────────────────────

export interface InvestStep {
  step: number;
  description: string;
  target: Address;
  calldata: `0x${string}`;
  value: string;
}

export async function buildInvestCalldata(
  usdcAmountStr: string,
  walletAddress: Address
): Promise<{
  steps: InvestStep[];
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

  const { minDepositWei } = await readProtocolLimits();
  if (minWethOut < minDepositWei) {
    throw new Error(
      `DepositTooSmall: ~${formatUnits(wethExpected, 18)} WETH below min ${formatUnits(minDepositWei, 18)} ETH.`
    );
  }

  const [gblinExpected] = await client.readContract({
    address: GBLIN_LENS,
    abi: LENS_ABI,
    functionName: "quoteBuy",
    args: [GBLIN, minWethOut],
  });
  const minGblinOut = applySlippageBuffer(gblinExpected, slippage.bps);

  // Two steps, not four: the Zap swaps USDC to WETH on the adapter and mints at NAV in the same
  // transaction, so nothing is left half-done between them. The allowance goes to the Zap, never to
  // the vault, and both bounds travel with the call: `minWethOut` on the swap, `minGblinOut` on the mint.
  const approveZapCalldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [GBLIN_ZAP, usdcUnits],
  });

  const buyCalldata = encodeFunctionData({
    abi: ZAP_ABI,
    functionName: "buyGBLINWithToken",
    args: [USDC, usdcUnits, minWethOut, minGblinOut, VENUE_FEE_500, walletAddress],
  });

  return {
    steps: [
      { step: 1, description: "Approve USDC to the GBLIN Zap", target: USDC, calldata: withBuilderSuffix(approveZapCalldata), value: "0" },
      { step: 2, description: "Swap USDC to WETH and mint GBLIN at NAV, in one transaction", target: GBLIN_ZAP, calldata: withBuilderSuffix(buyCalldata), value: "0" },
    ],
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
      address: GBLIN,
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
