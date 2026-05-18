/**
 * GET /api/x402/invest?usdc=10
 *
 * Treasury accumulation: converts USDC earnings into GBLIN. Returns two
 * sequential transactions:
 *   1. approve USDC to GBLIN_V5
 *   2. buyGBLINWithToken(path, amountIn, minWethOut, minGblinOut)
 *
 * Both transactions have non-zero minOut values to prevent MEV sandwich.
 *
 * Paywall: $0.002 USDC per call.
 */

import {
  GBLIN_V5,
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

    if (!usdc || !/^\d+(\.\d+)?$/.test(usdc)) {
      return jsonResponse(
        { error: "Invalid 'usdc' query param. Must be a positive decimal string." },
        400
      );
    }

    const [calldata, slippage] = await Promise.all([
      buildInvestCalldata(usdc),
      getDynamicSlippage(),
    ]);

    return jsonResponse({
      action: "sequential_txs",
      steps: [
        {
          step: 1,
          description: "Approve GBLIN contract to spend USDC",
          target: USDC,
          calldata: calldata.approveCalldata,
          value: "0",
        },
        {
          step: 2,
          description: "Buy GBLIN with USDC via native contract function",
          target: GBLIN_V5,
          calldata: calldata.buyCalldata,
          value: "0",
        },
      ],
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
