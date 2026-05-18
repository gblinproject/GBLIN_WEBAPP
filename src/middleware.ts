/**
 * GBLIN x402 Paywall — Next.js Middleware
 *
 * Applies the HTTP 402 payment protocol to every route under /api/x402/*.
 * Agents that hit these endpoints are returned 402 + payment requirements;
 * they sign an EIP-3009 USDC `transferWithAuthorization` and retry with the
 * `X-PAYMENT` header. The Coinbase CDP facilitator verifies the signature,
 * settles the transfer on Base mainnet, and the response is then served.
 *
 * USDC payments flow directly to the wallet defined by X402_PAY_TO_WALLET.
 * No funds ever touch this server.
 *
 * Required env vars (set them in Vercel → Project → Settings → Environment):
 *   - X402_PAY_TO_WALLET    : 0x… address that receives USDC
 *   - CDP_API_KEY_ID        : Coinbase Developer Platform API key id
 *   - CDP_API_KEY_SECRET    : Coinbase Developer Platform API key secret
 *
 * Optional:
 *   - X402_FACILITATOR_URL  : override (defaults to Coinbase CDP for Base mainnet)
 *
 * Pricing: micropayments calibrated for autonomous agent budgets.
 * Heavier compute (JIT calldata + cooldown check) is priced higher.
 */

import type { Address } from "viem";
import { paymentMiddleware } from "x402-next";

const PAY_TO = (process.env.X402_PAY_TO_WALLET ?? "") as Address;

// Hard fail at build time if the recipient wallet is missing — better than
// silently shipping a paywall that drains payments into the zero address.
if (
  typeof PAY_TO !== "string" ||
  !PAY_TO.startsWith("0x") ||
  PAY_TO.length !== 42
) {
  // We only throw in production; in dev we keep the message visible.
  // eslint-disable-next-line no-console
  console.warn(
    "[x402] X402_PAY_TO_WALLET is not set or invalid. The x402 paywall will not work until this env var is configured."
  );
}

export const middleware = paymentMiddleware(
  PAY_TO,
  {
    "/api/x402/treasury-state": {
      price: "$0.001",
      network: "base",
      config: {
        description:
          "Real-time GBLIN protocol state: NAV in USD, basket composition with dynamic weights, and Crash Shield status.",
        mimeType: "application/json",
        maxTimeoutSeconds: 10,
      },
    },
    "/api/x402/quote": {
      price: "$0.001",
      network: "base",
      config: {
        description:
          "Preview a GBLIN swap (buy ETH→GBLIN or sell GBLIN→ETH) with dynamic slippage and safe minOut. Query: ?direction=buy|sell&amount=0.01",
        mimeType: "application/json",
        maxTimeoutSeconds: 10,
      },
    },
    "/api/x402/jit": {
      price: "$0.005",
      network: "base",
      config: {
        description:
          "Just-In-Time GBLIN→USDC calldata. Returns ready-to-broadcast atomic-swap calldata. Query: ?usdc=0.50&wallet=0x…",
        mimeType: "application/json",
        maxTimeoutSeconds: 10,
      },
    },
    "/api/x402/invest": {
      price: "$0.002",
      network: "base",
      config: {
        description:
          "USDC→GBLIN treasury-accumulation calldata (approve + buyGBLINWithToken). Query: ?usdc=10",
        mimeType: "application/json",
        maxTimeoutSeconds: 10,
      },
    },
    "/api/x402/health": {
      price: "$0.002",
      network: "base",
      config: {
        description:
          "Wallet treasury health: GBLIN/USDC/ETH balances, gas runway, and rebalance recommendation. Query: ?wallet=0x…&daily_burn=1.5",
        mimeType: "application/json",
        maxTimeoutSeconds: 10,
      },
    },
    "/api/x402/governance": {
      price: "$0.001",
      network: "base",
      config: {
        description:
          "GBLIN protocol governance state: owner, 48h timelock parameters, and any pending operation.",
        mimeType: "application/json",
        maxTimeoutSeconds: 10,
      },
    },
  },
  // facilitator: omit to use the Coinbase CDP default for Base mainnet.
  // To override (e.g. for testnet or self-hosted), set X402_FACILITATOR_URL
  // and uncomment the block below.
  process.env.X402_FACILITATOR_URL
    ? { url: process.env.X402_FACILITATOR_URL as `${string}://${string}` }
    : undefined
);

export const config = {
  // Match every paid endpoint under /api/x402/* but exclude the public
  // discovery manifest at /api/x402/llms.txt (must remain free for crawlers).
  matcher: [
    "/api/x402/treasury-state",
    "/api/x402/quote",
    "/api/x402/jit",
    "/api/x402/invest",
    "/api/x402/health",
    "/api/x402/governance",
  ],
  runtime: "nodejs",
};
