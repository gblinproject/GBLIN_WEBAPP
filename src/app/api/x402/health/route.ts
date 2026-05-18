/**
 * GET /api/x402/health?wallet=0x…&daily_burn=1.5
 *
 * Analyzes an agent wallet's treasury health: GBLIN/USDC/ETH balances,
 * gas runway, and (if daily_burn provided) days of operational runway plus
 * a rebalance recommendation.
 *
 * Paywall: $0.002 USDC per call.
 */

import {
  checkCooldown,
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

    const [balances, cooldown] = await Promise.all([
      getWalletBalances(wallet),
      checkCooldown(wallet),
    ]);

    const ethBalanceNum = Number(balances.ethFormatted);
    const gasHealth: "sufficient" | "low" | "critical" =
      ethBalanceNum >= 0.001
        ? "sufficient"
        : ethBalanceNum >= 0.0003
          ? "low"
          : "critical";

    const usdcNum = Number(balances.usdcFormatted);
    const gblinPct =
      balances.totalUsd > 0
        ? (balances.gblinValueUsd / balances.totalUsd) * 100
        : 0;
    const usdcPct =
      balances.totalUsd > 0 ? (usdcNum / balances.totalUsd) * 100 : 0;

    let recommendation: {
      target_gblin_pct: number;
      target_usdc_pct: number;
      action: "rebalance_to_gblin" | "rebalance_to_usdc" | "hold";
      runway_days: number | null;
      reasoning: string;
    } = {
      target_gblin_pct: 90,
      target_usdc_pct: 10,
      action: "hold",
      runway_days: null,
      reasoning: "No daily_burn provided. Default preset is aggressive 90/10.",
    };

    if (dailyBurn !== undefined && dailyBurn > 0) {
      const highBurn = dailyBurn > 2;
      const targetGblin = highBurn ? 70 : 90;
      const targetUsdc = highBurn ? 30 : 10;
      const runwayDays = Math.floor(usdcNum / dailyBurn);

      let action: "rebalance_to_gblin" | "rebalance_to_usdc" | "hold" = "hold";
      if (usdcPct < targetUsdc - 5) action = "rebalance_to_usdc";
      else if (usdcPct > targetUsdc + 10) action = "rebalance_to_gblin";

      recommendation = {
        target_gblin_pct: targetGblin,
        target_usdc_pct: targetUsdc,
        action,
        runway_days: runwayDays,
        reasoning: highBurn
          ? `High burn rate ($${dailyBurn}/day): hold larger USDC buffer (30%) to avoid forced liquidations.`
          : `Low burn rate ($${dailyBurn}/day): maximize GBLIN exposure (90%) for treasury yield. JIT-swap on demand.`,
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
        warning:
          gasHealth === "critical"
            ? "ETH below 0.0003 — JIT swaps will likely fail. Top up immediately."
            : gasHealth === "low"
              ? "ETH between 0.0003 and 0.001 — limited gas headroom."
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
