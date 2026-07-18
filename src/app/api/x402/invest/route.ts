/**
 * GET /api/x402/invest?usdc=10&wallet=0x...
 *
 * Treasury accumulation: converts USDC earnings into GBLIN. Returns four
 * sequential transactions (bypasses broken exactInput in contract):
 *   1. approve USDC to SwapRouter02
 *   2. swap USDC→WETH via exactInputSingle
 *   3. approve WETH to GBLIN
 *   4. buyGBLINWithToken with WETH as tokenIn
 *
 * All transactions have non-zero minOut values to prevent MEV sandwich.
 *
 * Paywall: $0.002 USDC per call.
 */

import {
  GBLIN,
  USDC,
  buildInvestCalldata,
  getDynamicSlippage,
  jsonResponse,
} from "@/lib/x402-helpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const usdc = searchParams.get("usdc");
    const wallet = searchParams.get("wallet");

    if (!usdc || !/^\d+(\.\d+)?$/.test(usdc)) {
      return jsonResponse(
        { error: "Invalid 'usdc' query param. Must be a positive decimal string." },
        400
      );
    }

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return jsonResponse(
        { error: "Invalid 'wallet' query param. Must be a valid Ethereum address." },
        400
      );
    }

    const [calldata, slippage] = await Promise.all([
      buildInvestCalldata(usdc, wallet as `0x${string}`),
      getDynamicSlippage(),
    ]);

    return jsonResponse({
      action: "sequential_txs",
      steps: calldata.steps,
      expected: {
        usdc_in: usdc,
        weth_min: calldata.minWethOut,
        gblin_expected: calldata.expectedGblinOut,
        gblin_min: calldata.minGblinOut,
        slippage_buffer_pct: slippage.pct,
        slippage_reason: slippage.reason,
      },
      security: {
        mev_protected: true,
        min_outs_set: true,
      },
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400);
  }
}
