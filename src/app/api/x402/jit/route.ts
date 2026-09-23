/**
 * GET /api/x402/jit?usdc=0.50&wallet=0x…
 *
 * Just-In-Time GBLIN → USDC: generates ready-to-broadcast atomic-swap
 * calldata. Use this immediately before paying an x402 invoice when the
 * agent's USDC balance is insufficient.
 *
 * GBLIN -> USDC in three steps: approve the shares to the Zap, GBLINZap.sellGBLINForEth, Uniswap WETH->USDC.
 * Returns a sequential_txs payload. EOAs sign three times; smart accounts can batch.
 * Step 2 carries an explicit gas limit: an automatic estimate can fall short.
 *
 * Paywall: $0.005 USDC per call.
 */

import { formatUnits } from "viem";
import {
  USDC,
  WETH_USDC_POOL_FEE,
  buildJitCalldata,
  checkCooldown,
  jsonResponse,
  parseWallet,
  quoteGblinForUsdc,
} from "@/lib/x402-helpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const usdc = searchParams.get("usdc");
    const walletParam = searchParams.get("wallet");

    if (!usdc || !/^\d+(\.\d+)?$/.test(usdc)) {
      return jsonResponse(
        { error: "Invalid 'usdc' query param. Must be a positive decimal string." },
        400
      );
    }
    const wallet = parseWallet(walletParam);

    // 1. Cooldown check (on-chain block timestamp)
    const cooldown = await checkCooldown(wallet);
    if (cooldown.active) {
      return jsonResponse(
        {
          error: `CooldownActive: ${cooldown.secondsRemaining}s remaining until sell is unlocked.`,
          hint: "The agent recently called buyGBLIN. Wait or use existing USDC reserves.",
          cooldown,
        },
        409
      );
    }

    // 2. Reverse quote: how much GBLIN must be sold?
    const quote = await quoteGblinForUsdc(usdc);

    // 3. Build the calldata (3 steps: approve to the Zap, Zap.sellGBLINForEth, Uniswap WETH->USDC)
    const jit = await buildJitCalldata(quote.gblinToSell, quote.minUsdcOut, quote.slippage.bps, wallet);

    return jsonResponse({
      action: "sequential_txs",
      steps: jit.steps,
      params: {
        gblin_amount: formatUnits(quote.gblinToSell, 18),
        eth_min_out: formatUnits(jit.minEthOut, 18),
        target_token: USDC,
        pool_fee: WETH_USDC_POOL_FEE,
        min_usdc_out: formatUnits(quote.minUsdcOut, 6),
      },
      expected: {
        usdc_out: formatUnits(quote.expectedUsdcOut, 6),
        nav_used_usd: Number(quote.navUsd.toFixed(6)),
        slippage_buffer_pct: quote.slippage.pct,
        slippage_reason: quote.slippage.reason,
      },
      compatibility: { eoa: true, erc4337: true, eip7702: true, note: "Redemption is three steps (approve to the Zap, Zap.sellGBLINForEth, Uniswap WETH->USDC). An EOA signs three times; ERC-4337/EIP-7702 can batch them into one operation." },
      gas_hint: 1_100_000,
      gas_hint_note: "Gas limit for step 2 (the Zap exit uses about 810,000 and forwards gas-capped transfers, so a tight limit reverts). Steps 1 and 3 are standard.",
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400);
  }
}
