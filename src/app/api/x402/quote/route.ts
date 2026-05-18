/**
 * GET /api/x402/quote?direction=buy|sell&amount=0.01
 *
 * Previews a GBLIN swap without executing. Returns expected output, safe
 * minOut with dynamic slippage buffer, and fee breakdown.
 *
 * - direction=buy   → `amount` is ETH amount (e.g. 0.01)
 * - direction=sell  → `amount` is GBLIN amount (e.g. 5.0)
 *
 * Paywall: $0.001 USDC per call.
 */

import { formatUnits, parseUnits } from "viem";
import {
  GBLIN_ABI,
  GBLIN_V5,
  MIN_DEPOSIT_WEI,
  applySlippageBuffer,
  client,
  getDynamicSlippage,
  jsonResponse,
} from "@/lib/x402-helpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const direction = searchParams.get("direction");
    const amount = searchParams.get("amount");

    if (direction !== "buy" && direction !== "sell") {
      return jsonResponse(
        { error: "Invalid direction. Must be 'buy' or 'sell'." },
        400
      );
    }
    if (!amount || !/^\d+(\.\d+)?$/.test(amount)) {
      return jsonResponse(
        { error: "Invalid amount. Must be a positive decimal string." },
        400
      );
    }

    const slippage = await getDynamicSlippage();
    const amountWei = parseUnits(amount, 18);

    if (direction === "buy") {
      if (amountWei < MIN_DEPOSIT_WEI) {
        return jsonResponse(
          {
            error: `DepositTooSmall: minimum buy is ${formatUnits(MIN_DEPOSIT_WEI, 18)} ETH.`,
            hint: "Increase amount or batch buys.",
          },
          400
        );
      }

      const [gblinOut, founderFee, stabFee] = await client.readContract({
        address: GBLIN_V5,
        abi: GBLIN_ABI,
        functionName: "quoteBuyGBLIN",
        args: [amountWei],
      });

      const safeMin = applySlippageBuffer(gblinOut, slippage.bps);
      return jsonResponse({
        direction: "buy",
        amount_in_eth: amount,
        expected_gblin_out: formatUnits(gblinOut, 18),
        safe_min_gblin_out: formatUnits(safeMin, 18),
        fees: {
          founder_eth: formatUnits(founderFee, 18),
          stability_eth: formatUnits(stabFee, 18),
          total_fee_bps: 10,
        },
        slippage_buffer_bps: Number(slippage.bps),
        slippage_reason: slippage.reason,
        next_step: "Call contract.buyGBLIN(safe_min_gblin_out) with msg.value = amount_in_eth.",
      });
    }

    // sell
    const ethOut = await client.readContract({
      address: GBLIN_V5,
      abi: GBLIN_ABI,
      functionName: "quoteSellGBLIN",
      args: [amountWei],
    });
    const safeMin = applySlippageBuffer(ethOut, slippage.bps);

    return jsonResponse({
      direction: "sell",
      amount_in_gblin: amount,
      expected_eth_out: formatUnits(ethOut, 18),
      safe_min_eth_out: formatUnits(safeMin, 18),
      slippage_buffer_bps: Number(slippage.bps),
      slippage_reason: slippage.reason,
      cooldown_note:
        "Sell reverts with CooldownActive if last buy was <2 min ago. Check via /api/x402/health.",
      next_step: "Call contract.sellGBLINForEth(amount, safe_min_eth_out).",
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
}
