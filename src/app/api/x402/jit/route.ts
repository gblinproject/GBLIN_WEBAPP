/**
 * GET /api/x402/jit?usdc=0.50&wallet=0x…
 *
 * Just-In-Time GBLIN → USDC: generates ready-to-broadcast atomic-swap
 * calldata. Use this immediately before paying an x402 invoice when the
 * agent's USDC balance is insufficient.
 *
 * V6: GBLIN -> USDC in two steps (sellGBLINForEth + Uniswap WETH->USDC).
 * Returns a sequential_txs payload. EOAs sign twice; smart accounts can batch.
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

    // 3. Build V6 calldata (2 steps: sellGBLINForEth + Uniswap WETH->USDC)
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
      compatibility: { eoa: true, erc4337: true, eip7702: true, note: "Redemption is two steps (sellGBLINForEth + Uniswap WETH->USDC). EOAs sign twice; ERC-4337/EIP-7702 can batch into one UserOp." },
      gas_hint: 600_000,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400);
  }
}
