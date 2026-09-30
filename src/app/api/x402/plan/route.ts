/**
 * GET /api/x402/plan?wallet=0x…&daily_burn=25&days=7&reserve=500&trial=100
 *
 * Turns idle USDC into a plan an agent can show and a human can confirm, in one call:
 *   - operating cash: the USDC to keep liquid, max(reserve, daily_burn × days), plain arithmetic
 *     on the caller's own inputs;
 *   - surplus: the USDC above it;
 *   - simulation: what minting the surplus into GBLIN at NAV would return today, with every fee
 *     read live from the vault and the estimated value of exiting the same position today, so the
 *     round-trip cost is visible before anything is signed;
 *   - trial: the same simulation for a small amount (100 USDC by default);
 *   - next: the prepare endpoints to call after confirmation. They return unsigned calldata only.
 *
 * Nothing is executed here and nothing is advised: GBLIN is crypto exposure (cbBTC, WETH, USDC),
 * not cash and not yield. The response says so, and says when parking is not appropriate at all
 * (crash shield active, redemption cooldown running, ETH that does not cover an exit).
 *
 * Free: no payment required. Responses carry a short CDN cache directive.
 */

import { formatUnits, parseUnits } from "viem";
import {
  GBLIN,
  GBLIN_LENS,
  LENS_ABI,
  WETH,
  WETH_USDC_POOL_FEE,
  applySlippageBuffer,
  assessExitGas,
  checkCooldown,
  client,
  getBasketState,
  getDynamicSlippage,
  getEthPriceUsd,
  getNavUsd,
  getWalletBalances,
  jsonResponse,
  parseWallet,
  readFeeSchedule,
  readProtocolLimits,
  FREE_CACHE_SHORT,
  type BasketState,
  type FeeSchedule,
  type SlippageProfile,
} from "@/lib/x402-helpers";

export const runtime = "nodejs";

const DEFAULT_RESERVE_DAYS = 7;
const DEFAULT_TRIAL_USDC = 100;
const MAX_DAYS = 365;
const BASE_URL = "https://gblin.digital";

const REGIME_LABEL = ["calm", "elevated", "crash"] as const;

/** Same rule as the attestation endpoint and the MCP get_market_risk_regime tool. */
function riskRegime(basket: BasketState): { code: 0 | 1 | 2; label: (typeof REGIME_LABEL)[number]; maxWeightCutPct: number } {
  const maxCut = basket.entries
    .filter((e) => !e.isStable && e.baseWeightBps > 0)
    .reduce((m, e) => Math.max(m, ((e.baseWeightBps - e.dynamicWeightBps) / e.baseWeightBps) * 100), 0);
  const code: 0 | 1 | 2 = maxCut <= 0 ? 0 : maxCut < 40 ? 1 : 2;
  return { code, label: REGIME_LABEL[code], maxWeightCutPct: Number(maxCut.toFixed(2)) };
}

function parseNonNegative(name: string, raw: string | null): number | undefined {
  if (raw === null || raw === "") return undefined;
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error(`Invalid '${name}': must be a non-negative decimal.`);
  return Number(raw);
}

interface Simulation {
  status: "ok" | "below_minimum";
  usdc_in: number;
  eth_price_usd: number;
  nav_usd: number;
  weth_expected: string;
  weth_min: string;
  gblin_expected: string;
  gblin_min: string;
  position_value_usd: number;
  fees: {
    entry_swap_fee_bps: number;
    protocol_fee_bps: number;
    stability_fee_bps: number;
    mint_fee_usd: number;
    management_fee_bps_per_year: number;
    management_fee_usd_per_year: number;
  };
  exit_today: {
    gblin_sold: string;
    eth_expected: string;
    gross_usd: number;
    dex_fee_estimate_bps: number;
    net_estimate_usd: number;
    method: string;
  };
  round_trip_cost_usd: number;
  round_trip_cost_bps: number;
  slippage_buffer_pct: number;
  slippage_reason: SlippageProfile["reason"];
  minimum_note?: string;
}

/**
 * Simulates minting `usdc` into GBLIN through the Zap (USDC -> WETH on the pool, mint at NAV) and
 * exiting the resulting position today (redeem in kind, sell the legs, WETH -> USDC). Reads only.
 */
async function simulateMint(
  usdc: number,
  ctx: {
    ethPriceUsd: number;
    navUsd: number;
    slippage: SlippageProfile;
    fees: FeeSchedule;
    basket: BasketState;
    minDepositWei: bigint;
  }
): Promise<Simulation> {
  const usdcUnits = parseUnits(usdc.toFixed(6), 6);
  const ethPriceScaled = BigInt(Math.round(ctx.ethPriceUsd * 1_000_000));
  const poolFeeBps = WETH_USDC_POOL_FEE / 100; // 500 -> 5 bps
  const wethGross = (usdcUnits * parseUnits("1", 18)) / ethPriceScaled;
  const wethExpected = (wethGross * BigInt(10_000 - poolFeeBps)) / 10_000n;
  const wethMin = applySlippageBuffer(wethExpected, ctx.slippage.bps);

  const base: Omit<Simulation, "gblin_expected" | "gblin_min" | "position_value_usd" | "fees" | "exit_today" | "round_trip_cost_usd" | "round_trip_cost_bps"> = {
    status: "ok",
    usdc_in: Number(usdc.toFixed(6)),
    eth_price_usd: Number(ctx.ethPriceUsd.toFixed(2)),
    nav_usd: Number(ctx.navUsd.toFixed(6)),
    weth_expected: formatUnits(wethExpected, 18),
    weth_min: formatUnits(wethMin, 18),
    slippage_buffer_pct: ctx.slippage.pct,
    slippage_reason: ctx.slippage.reason,
  };

  if (wethMin < ctx.minDepositWei) {
    return {
      ...base,
      status: "below_minimum",
      gblin_expected: "0",
      gblin_min: "0",
      position_value_usd: 0,
      fees: {
        entry_swap_fee_bps: poolFeeBps,
        protocol_fee_bps: ctx.fees.protocolFeeBps,
        stability_fee_bps: ctx.fees.stabilityFeeBps,
        mint_fee_usd: 0,
        management_fee_bps_per_year: ctx.fees.managementFeeBps,
        management_fee_usd_per_year: 0,
      },
      exit_today: { gblin_sold: "0", eth_expected: "0", gross_usd: 0, dex_fee_estimate_bps: 0, net_estimate_usd: 0, method: "not simulated" },
      round_trip_cost_usd: 0,
      round_trip_cost_bps: 0,
      minimum_note: `Below the vault's minimum deposit of ${formatUnits(ctx.minDepositWei, 18)} ETH after the slippage buffer.`,
    };
  }

  const [[gblinExpected, protocolFeeWei, stabilityFeeWei], [gblinAtMin]] = await Promise.all([
    client.readContract({ address: GBLIN_LENS, abi: LENS_ABI, functionName: "quoteBuy", args: [GBLIN, wethExpected] }),
    client.readContract({ address: GBLIN_LENS, abi: LENS_ABI, functionName: "quoteBuy", args: [GBLIN, wethMin] }),
  ]);
  const gblinMin = applySlippageBuffer(gblinAtMin, ctx.slippage.bps);

  // Exit today: the Zap redeems in kind and sells every leg but WETH to WETH, then the agent swaps
  // WETH -> USDC. quoteSell prices the shares at NAV; the pool fee is estimated once on every leg sold
  // and once on the final swap. Price impact is not estimated: the minimums bound it at execution.
  const ethBack = await client.readContract({ address: GBLIN_LENS, abi: LENS_ABI, functionName: "quoteSell", args: [GBLIN, gblinExpected] });
  const grossUsd = Number(formatUnits(ethBack, 18)) * ctx.ethPriceUsd;
  const wethRow = ctx.basket.entries.find((e) => e.token.toLowerCase() === WETH.toLowerCase());
  const wethWeight = wethRow ? wethRow.dynamicWeightBps / 10_000 : 0;
  const dexFeeBps = Number(((1 - wethWeight) * poolFeeBps + poolFeeBps).toFixed(2));
  const netUsd = grossUsd * (1 - dexFeeBps / 10_000);

  const mintFeeUsd = Number(formatUnits(protocolFeeWei + stabilityFeeWei, 18)) * ctx.ethPriceUsd;
  const positionUsd = Number(formatUnits(gblinExpected, 18)) * ctx.navUsd;
  const roundTrip = usdc - netUsd;

  return {
    ...base,
    gblin_expected: formatUnits(gblinExpected, 18),
    gblin_min: formatUnits(gblinMin, 18),
    position_value_usd: Number(positionUsd.toFixed(4)),
    fees: {
      entry_swap_fee_bps: poolFeeBps,
      protocol_fee_bps: ctx.fees.protocolFeeBps,
      stability_fee_bps: ctx.fees.stabilityFeeBps,
      mint_fee_usd: Number(mintFeeUsd.toFixed(4)),
      management_fee_bps_per_year: ctx.fees.managementFeeBps,
      management_fee_usd_per_year: Number(((usdc * ctx.fees.managementFeeBps) / 10_000).toFixed(4)),
    },
    exit_today: {
      gblin_sold: formatUnits(gblinExpected, 18),
      eth_expected: formatUnits(ethBack, 18),
      gross_usd: Number(grossUsd.toFixed(4)),
      dex_fee_estimate_bps: dexFeeBps,
      net_estimate_usd: Number(netUsd.toFixed(4)),
      method:
        "Shares priced by the Lens at NAV (quoteSell), converted at the Chainlink ETH/USD price; pool fee applied to every leg sold and to the final WETH->USDC swap; price impact not estimated.",
    },
    round_trip_cost_usd: Number(roundTrip.toFixed(4)),
    round_trip_cost_bps: Number(((roundTrip / usdc) * 10_000).toFixed(2)),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = parseWallet(searchParams.get("wallet"));
    const dailyBurn = parseNonNegative("daily_burn", searchParams.get("daily_burn"));
    const reserve = parseNonNegative("reserve", searchParams.get("reserve"));
    const daysRaw = searchParams.get("days");
    const trialRaw = parseNonNegative("trial", searchParams.get("trial"));

    if (dailyBurn === undefined && reserve === undefined) {
      return jsonResponse(
        {
          error: "Provide 'daily_burn' (USD per day) or 'reserve' (USD to keep liquid), or both.",
          hint: "Operating cash = max(reserve, daily_burn × days); days defaults to 7.",
        },
        400
      );
    }
    let days = DEFAULT_RESERVE_DAYS;
    if (daysRaw !== null && daysRaw !== "") {
      if (!/^\d+$/.test(daysRaw) || Number(daysRaw) < 1 || Number(daysRaw) > MAX_DAYS) {
        return jsonResponse({ error: `Invalid 'days': integer between 1 and ${MAX_DAYS}.` }, 400);
      }
      days = Number(daysRaw);
    }
    const trial = trialRaw && trialRaw > 0 ? trialRaw : DEFAULT_TRIAL_USDC;

    // Shared values first, one at a time, so the cached price, NAV and basket serve every read below
    // instead of firing a dozen calls at once.
    const ethPriceUsd = await getEthPriceUsd();
    const navUsd = await getNavUsd();
    const basket = await getBasketState();
    const slippage = await getDynamicSlippage();
    const [balances, cooldown, gasPrice, limits, fees, block] = await Promise.all([
      getWalletBalances(wallet),
      checkCooldown(wallet),
      client.getGasPrice(),
      readProtocolLimits(),
      readFeeSchedule(),
      client.getBlockNumber(),
    ]);

    const regime = riskRegime(basket);
    const gas = assessExitGas(parseUnits(balances.ethFormatted, 18), gasPrice);
    const usdc = Number(balances.usdcFormatted);

    const operatingCash = Math.max(reserve ?? 0, (dailyBurn ?? 0) * days);
    const surplus = Math.max(0, usdc - operatingCash);
    const runwayDays = dailyBurn && dailyBurn > 0 ? Math.floor(usdc / dailyBurn) : null;

    const ctx = { ethPriceUsd, navUsd, slippage, fees, basket, minDepositWei: limits.minDepositWei };
    const simulation = surplus > 0 ? await simulateMint(surplus, ctx) : null;
    const trialSimulation = await simulateMint(trial, ctx);

    // Parking is a candidate only when the shield is idle, no redemption cooldown is running and the
    // wallet can pay for its own exit. Each blocker is named; none is a recommendation to proceed.
    const blockers: string[] = [];
    if (basket.crashShieldActive) blockers.push("crash shield active: a basket row is being cut; wait until it clears");
    if (cooldown.active) blockers.push(`redemption cooldown running for ${cooldown.secondsRemaining}s after a mint for this wallet`);
    if (gas.status === "critical") blockers.push("ETH does not cover one three-step exit at the current gas price");
    if (surplus <= 0) blockers.push("no USDC above the operating cash");
    if (simulation && simulation.status === "below_minimum") blockers.push("surplus is below the vault's minimum deposit");

    const walletParam = `wallet=${wallet}`;
    const surplusParam = surplus > 0 ? surplus.toFixed(2) : "0";

    return jsonResponse(
      {
        wallet,
        as_of: { block: block.toString(), unix: Math.floor(Date.now() / 1000) },
        inputs: { daily_burn_usd: dailyBurn ?? null, days, reserve_usd: reserve ?? null, trial_usdc: trial },
        market: {
          nav_usd: Number(navUsd.toFixed(6)),
          eth_price_usd: Number(ethPriceUsd.toFixed(2)),
          regime: regime.label,
          regime_code: regime.code,
          max_weight_cut_pct: regime.maxWeightCutPct,
          crash_shield_active: basket.crashShieldActive,
          basket: basket.entries.map((e) => ({
            token: e.token,
            is_stable: e.isStable,
            base_weight_pct: e.baseWeightBps / 100,
            dynamic_weight_pct: e.dynamicWeightBps / 100,
            shielded: e.isSlashed,
          })),
        },
        wallet_state: {
          usdc: balances.usdcFormatted,
          gblin: balances.gblinFormatted,
          gblin_value_usd: Number(balances.gblinValueUsd.toFixed(4)),
          eth: balances.ethFormatted,
          gas_health: { status: gas.status, exit_cost_eth: formatUnits(gas.exitCostWei, 18) },
          cooldown: { active: cooldown.active, seconds_remaining: cooldown.secondsRemaining },
        },
        operating_cash: {
          usdc: Number(operatingCash.toFixed(2)),
          rule: "max(reserve, daily_burn × days)",
          runway_days: runwayDays,
        },
        surplus: { usdc: Number(surplus.toFixed(2)) },
        park_candidate: blockers.length === 0,
        blockers,
        simulation:
          simulation ?? { status: "nothing_to_park", reason: "USDC does not exceed the operating cash." },
        trial: trialSimulation,
        next: {
          invest: surplus > 0 ? `${BASE_URL}/api/x402/invest?usdc=${surplusParam}&${walletParam}` : null,
          invest_trial: `${BASE_URL}/api/x402/invest?usdc=${trial}&${walletParam}`,
          jit: `${BASE_URL}/api/x402/jit?usdc=<amount>&${walletParam}`,
          health: `${BASE_URL}/api/x402/health?${walletParam}${dailyBurn ? `&daily_burn=${dailyBurn}` : ""}`,
          note: "Each prepare endpoint returns unsigned calldata with non-zero minimums. Show the simulation and ask for confirmation before signing; nothing here executes.",
        },
        notes: [
          "GBLIN is a basket of cbBTC, WETH and USDC held in the contract and priced by Chainlink: its value moves with cbBTC and WETH. It is not a stablecoin and carries no yield.",
          "Operating cash is arithmetic on the caller's own inputs, not an allocation advice. The surplus is a candidate, never a recommendation.",
          "Every rate above is read from the vault at the block shown; governance can change them through the 48-hour timelock within the bounds written in the contract.",
          "Redemption in kind reads no price feed and cannot be paused: shares can always be burned for the underlying assets.",
          "GBLIN shares implement EIP-3009: a holder can pay in GBLIN with a signature and no ETH through /api/relay/gblin.",
        ],
      },
      200,
      FREE_CACHE_SHORT
    );
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400);
  }
}
