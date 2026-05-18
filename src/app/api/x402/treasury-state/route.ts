/**
 * GET /api/x402/treasury-state
 *
 * Reads GBLIN protocol state on Base mainnet and returns NAV (USD per GBLIN),
 * basket composition with dynamic weights, and Crash Shield status.
 *
 * Paywall: $0.001 USDC per call (configured in src/middleware.ts).
 * Read-only — no private keys.
 */

import {
  GBLIN_V5,
  getBasketState,
  getDynamicSlippage,
  getEthPriceUsd,
  getNavUsd,
  jsonResponse,
} from "@/lib/x402-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [navUsd, ethPriceUsd, basket, slippage] = await Promise.all([
      getNavUsd(),
      getEthPriceUsd(),
      getBasketState(),
      getDynamicSlippage(),
    ]);

    return jsonResponse({
      nav_usd: Number(navUsd.toFixed(6)),
      eth_price_usd: Number(ethPriceUsd.toFixed(2)),
      crash_shield_active: basket.crashShieldActive,
      slippage_buffer_pct: slippage.pct,
      slippage_reason: slippage.reason,
      basket: basket.entries.map((e) => ({
        token: e.token,
        is_stable: e.isStable,
        base_weight_pct: e.baseWeightBps / 100,
        dynamic_weight_pct: e.dynamicWeightBps / 100,
        slashed: e.isSlashed,
        pool_fee_bps: e.poolFee,
      })),
      meta: {
        contract: GBLIN_V5,
        chain: "base",
        chain_id: 8453,
        as_of_unix: Math.floor(Date.now() / 1000),
      },
    });
  } catch (err) {
    return jsonResponse(
      { error: (err as Error).message, hint: "Check RPC connectivity and oracle freshness." },
      500
    );
  }
}
