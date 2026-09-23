/**
 * GET /api/x402/health?wallet=0x…&daily_burn=1.5
 *
 * Analyzes an agent wallet's treasury health: GBLIN/USDC/ETH balances,
 * whether the ETH covers an exit at the live gas price, the redemption cooldown,
 * and (if daily_burn is provided) days of USDC runway plus a recommendation that
 * keeps seven days of spend in USDC and treats only the surplus as a candidate
 * for GBLIN, which is crypto exposure, not cash and not yield.
 *
 * Paywall: $0.002 USDC per call.
 */

import { formatUnits, parseUnits } from "viem";
import {
  ZAP_GAS_LIMIT,
  checkCooldown,
  client,
  getBasketState,
  getWalletBalances,
  jsonResponse,
  parseWallet,
} from "@/lib/x402-helpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = parseWallet(searchParams.get("wallet"));
    const dailyBurnStr = searchParams.get("daily_burn");
    const dailyBurn = dailyBurnStr ? parseFloat(dailyBurnStr) : undefined;

    if (dailyBurn !== undefined && (isNaN(dailyBurn) || dailyBurn < 0)) {
      return jsonResponse(
        { error: "Invalid 'daily_burn'. Must be a non-negative number." },
        400
      );
    }

    const [balances, cooldown, basket, gasPrice] = await Promise.all([
      getWalletBalances(wallet),
      checkCooldown(wallet),
      getBasketState(),
      client.getGasPrice(),
    ]);

    // Gas: what the three-step exit costs at the live gas price, with a fivefold margin for spikes.
    const exitGas = 46_000n + BigInt(ZAP_GAS_LIMIT) + 120_000n;
    const exitCostWei = exitGas * gasPrice;
    const ethBalanceWei = parseUnits(balances.ethFormatted, 18);
    const gasHealth: "sufficient" | "low" | "critical" =
      ethBalanceWei >= exitCostWei * 5n ? "sufficient" : ethBalanceWei >= exitCostWei ? "low" : "critical";

    const usdcNum = Number(balances.usdcFormatted);
    const gblinPct =
      balances.totalUsd > 0
        ? (balances.gblinValueUsd / balances.totalUsd) * 100
        : 0;
    const usdcPct =
      balances.totalUsd > 0 ? (usdcNum / balances.totalUsd) * 100 : 0;

    // Operating cash stays in USDC — seven days of spend — and only the surplus above it is a
    // candidate for GBLIN. Adding to GBLIN is never advised while the crash shield is active.
    const RESERVE_DAYS = 7;
    let recommendation: {
      target_gblin_pct: number | null;
      target_usdc_pct: number | null;
      usdc_reserve_usd: number | null;
      action: "rebalance_to_gblin" | "rebalance_to_usdc" | "hold";
      runway_days: number | null;
      reasoning: string;
    } = {
      target_gblin_pct: null,
      target_usdc_pct: null,
      usdc_reserve_usd: null,
      action: "hold",
      runway_days: null,
      reasoning:
        "No daily_burn provided, so no allocation is advised. Pass it to get one: the rule keeps seven days of spend in USDC and treats only the surplus as a candidate for GBLIN.",
    };

    if (dailyBurn !== undefined && dailyBurn > 0) {
      const reserveUsd = dailyBurn * RESERVE_DAYS;
      const runwayDays = Math.floor(usdcNum / dailyBurn);
      const targetUsdcPct = balances.totalUsd > 0 ? Math.min(100, (reserveUsd / balances.totalUsd) * 100) : 100;

      let action: "rebalance_to_gblin" | "rebalance_to_usdc" | "hold" = "hold";
      let reasoning: string;
      if (usdcNum < reserveUsd * 0.8 && balances.gblinValueUsd > 0) {
        action = "rebalance_to_usdc";
        reasoning = `USDC covers ${runwayDays} days against a reserve of ${RESERVE_DAYS}: exit enough GBLIN to rebuild the reserve (/api/x402/jit).`;
      } else if (usdcNum > reserveUsd * 1.5 && !basket.crashShieldActive) {
        action = "rebalance_to_gblin";
        reasoning = `USDC holds ${runwayDays} days of spend, above the ${RESERVE_DAYS}-day reserve: the surplus of about $${(usdcNum - reserveUsd).toFixed(2)} is a candidate for GBLIN (/api/x402/invest), if long-horizon crypto exposure fits the mandate.`;
      } else if (usdcNum > reserveUsd * 1.5) {
        reasoning = "USDC is above the reserve, but the crash shield is active: hold, and add to GBLIN only after it clears.";
      } else {
        reasoning = `USDC holds ${runwayDays} days of spend, close to the ${RESERVE_DAYS}-day reserve: nothing to move.`;
      }

      recommendation = {
        target_gblin_pct: Number((100 - targetUsdcPct).toFixed(2)),
        target_usdc_pct: Number(targetUsdcPct.toFixed(2)),
        usdc_reserve_usd: Number(reserveUsd.toFixed(2)),
        action,
        runway_days: runwayDays,
        reasoning,
      };
    }

    return jsonResponse({
      wallet,
      balances: {
        gblin: balances.gblinFormatted,
        gblin_value_usd: Number(balances.gblinValueUsd.toFixed(4)),
        usdc: balances.usdcFormatted,
        eth: balances.ethFormatted,
        eth_value_usd: Number(balances.ethValueUsd.toFixed(4)),
        total_usd: Number(balances.totalUsd.toFixed(4)),
      },
      ratios: {
        gblin_pct: Number(gblinPct.toFixed(2)),
        usdc_pct: Number(usdcPct.toFixed(2)),
      },
      gas_health: {
        status: gasHealth,
        eth_balance: balances.ethFormatted,
        exit_cost_eth: formatUnits(exitCostWei, 18),
        warning:
          gasHealth === "critical"
            ? "ETH does not cover one three-step exit at the current gas price: top up before an invoice is due."
            : gasHealth === "low"
              ? "ETH covers the exit, but with less than a fivefold margin for a gas spike."
              : null,
      },
      cooldown: {
        active: cooldown.active,
        seconds_remaining: cooldown.secondsRemaining,
        last_deposit_unix: cooldown.lastDeposit,
      },
      recommendation,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400);
  }
}
