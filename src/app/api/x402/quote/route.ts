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
  GBLIN,
  readProtocolLimits,
  applySlippageBuffer,
  client,
  getDynamicSlippage,
  jsonResponse,
  GBLIN_LENS,
  LENS_ABI,
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
      const { minDepositWei } = await readProtocolLimits();
      if (amountWei < minDepositWei) {
        return jsonResponse(
          {
            error: `DepositTooSmall: minimum buy is ${formatUnits(minDepositWei, 18)} ETH.`,
            hint: "Increase amount or batch buys.",
          },
          400
        );
      }

      const [gblinOut, protocolFee, stabFee] = await client.readContract({
        address: GBLIN_LENS,
        abi: LENS_ABI,
        functionName: "quoteBuy",
        args: [GBLIN, amountWei],
      });

      const safeMin = applySlippageBuffer(gblinOut, slippage.bps);
      return jsonResponse({
        direction: "buy",
        amount_in_eth: amount,
        expected_gblin_out: formatUnits(gblinOut, 18),
        safe_min_gblin_out: formatUnits(safeMin, 18),
        fees: {
          protocol_eth: formatUnits(protocolFee, 18),
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
      address: GBLIN_LENS,
      abi: LENS_ABI,
      functionName: "quoteSell",
      args: [GBLIN, amountWei],
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
        "A sale reverts with CooldownActive during the vault's redemption cooldown after a mint for oneself (live value in /api/x402/health).",
      next_step:
        "Approve the shares to the GBLIN Zap, then call GBLINZap.sellGBLINForEth(shares, safe_min_eth_out, venueData, receiver). Allow at least 1,100,000 gas for that call. Redemption in kind (vault.sellGBLIN) needs no quote and no minimum.",
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
}
