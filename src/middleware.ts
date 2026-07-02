/**
 * GBLIN x402 Paywall — Next.js Middleware (x402 protocol v2)
 *
 * Applies HTTP 402 to every route under /api/x402/* (except the public
 * discovery manifest at /api/x402/llms.txt which stays free).
 *
 * Flow (v2 spec):
 *   1. Agent GETs an endpoint → server replies 402 with `PAYMENT-REQUIRED` header
 *      containing the v2 `accepts[]` requirements.
 *   2. Agent signs an EIP-3009 USDC `transferWithAuthorization` and retries
 *      with the `PAYMENT-SIGNATURE` header.
 *   3. The configured facilitator verifies the signature, settles on-chain on
 *      Base mainnet (CAIP-2 `eip155:8453`), then the handler response is served.
 *
 * USDC payments flow directly to `X402_PAY_TO_WALLET`. No funds touch this server.
 *
 * Bazaar discovery: each route advertises a JSON schema via
 * `declareDiscoveryExtension` so x402scan / Bazaar crawlers can index us
 * automatically and agents can synthesize correct query parameters.
 *
 * Required env vars (Vercel → Project → Settings → Environment):
 *   - X402_PAY_TO_WALLET   : 0x… address that receives USDC
 *
 * Optional:
 *   - CDP_API_KEY_ID / CDP_API_KEY_SECRET : when set, the CDP facilitator is
 *     used BY DEFAULT (required for x402 Bazaar indexing of these endpoints).
 *   - X402_ENABLE_CDP="false" : opt OUT of CDP (falls back to PayAI/custom).
 *   - X402_FACILITATOR_URL : non-CDP fallback facilitator
 *                            • default: https://facilitator.payai.network
 *                            • note: x402.org è ormai SOLO testnet
 *
 * Pricing: micropayments calibrated for autonomous agent budgets.
 */

import type { NextRequest } from "next/server";
import type { Address } from "viem";
import { paymentProxy } from "@x402/next";
import { PaywallBuilder, evmPaywall } from "@x402/paywall";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  declareDiscoveryExtension,
  bazaarResourceServerExtension,
} from "@x402/extensions/bazaar";
import { createFacilitatorConfig } from "@coinbase/x402";

const PAY_TO = (process.env.X402_PAY_TO_WALLET ?? "") as Address;

// Soft-warn at build time if the recipient wallet is missing. We do not throw
// because Next.js evaluates middleware during `next build` and we want builds
// to succeed without secrets (Vercel preview deployments).
if (
  typeof PAY_TO !== "string" ||
  !PAY_TO.startsWith("0x") ||
  PAY_TO.length !== 42
) {
  // eslint-disable-next-line no-console
  console.warn(
    "[x402] X402_PAY_TO_WALLET is not set or invalid. The x402 paywall will not settle until this env var is configured."
  );
}

// CAIP-2 identifier required by x402 v2 — Base mainnet.
const NETWORK = "eip155:8453" as const;

// Facilitator selection — auto-detect:
//   1. If CDP_API_KEY_ID + CDP_API_KEY_SECRET are set → use Coinbase CDP
//      facilitator (signed requests, free tier 1k tx/mo, official Bazaar listing).
//   2. Else if X402_FACILITATOR_URL is set → use that (e.g. PayAI).
//   3. Else → fall back to the public https://x402.org/facilitator.
// The `@coinbase/x402` package builds an authenticated FacilitatorConfig that
// signs every verify/settle call with our CDP key — required by CDP.
const cdpKeyId = process.env.CDP_API_KEY_ID;
const cdpKeySecret = process.env.CDP_API_KEY_SECRET;
// CDP is the DEFAULT when keys are present: only CDP-settled payments are
// indexed by the x402 Bazaar (discovery + ranking). The old 401 problem was
// on getSupported() only — handled by ResilientFacilitatorClient below,
// so verify/settle can run against CDP.
// Rollback senza toccare il codice: X402_ENABLE_CDP="false" → PayAI.
const useCdp =
  !!cdpKeyId && !!cdpKeySecret && process.env.X402_ENABLE_CDP !== "false";
/**
 * Facilitator client with a resilient getSupported().
 * The CDP /supported route 401s with @coinbase/x402@2.1.0 auth headers
 * (known upstream bug); verify/settle use per-request signed headers and
 * are unaffected. Without supported kinds, buildPaymentRequirements()
 * throws "Facilitator does not support exact on eip155:8453" on every
 * request. So: try the real call first, and on failure fall back to the
 * statically known CDP capabilities so initialize() always succeeds.
 */
class ResilientFacilitatorClient extends HTTPFacilitatorClient {
  async getSupported() {
    try {
      return await super.getSupported();
    } catch {
      return {
        kinds: [
          { x402Version: 2, scheme: "exact", network: NETWORK },
          { x402Version: 1, scheme: "exact", network: NETWORK },
        ],
        extensions: ["bazaar"],
        signers: {},
      };
    }
  }
}

const facilitatorClient = new ResilientFacilitatorClient(
  useCdp
    ? createFacilitatorConfig(cdpKeyId as string, cdpKeySecret as string)
    : {
        url: (process.env.X402_FACILITATOR_URL ??
          "https://facilitator.payai.network") as `${string}://${string}`,
      }
);
// bazaarResourceServerExtension enriches each route's declared discovery
// metadata (adds HTTP method, validates schemas) and attaches it to the
// payment payload — REQUIRED for the CDP facilitator to catalog us in the
// Bazaar after the first successful settlement.
const server = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);

// Shared accepts helper — every endpoint is paid in USDC on Base mainnet to the
// same treasury wallet, only the price varies.
const accepts = (price: `$${string}`) => [
  {
    scheme: "exact" as const,
    price,
    network: NETWORK,
    payTo: PAY_TO,
  },
];

// Rich 402 paywall UI (connect wallet + one-click pay) for humans who open a
// paid endpoint in a browser. Server-side HTML only — agents still receive the
// machine-readable 402 with x402 requirements. Network: Base mainnet (EVM).
const PAYWALL_CONFIG = {
  appName: "GBLIN Protocol",
  appLogo:
    "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png",
  testnet: false,
};
const paywall = new PaywallBuilder()
  .withNetwork(evmPaywall)
  .withConfig(PAYWALL_CONFIG)
  .build();

const x402Middleware = paymentProxy(
  {
    "/api/x402/treasury-state": {
      accepts: accepts("$0.001"),
      description:
        "Real-time GBLIN protocol state: NAV in USD, basket composition with dynamic weights, and Crash Shield status.",
      mimeType: "application/json",
      extensions: {
        ...declareDiscoveryExtension({
          input: {},
          inputSchema: { type: "object", properties: {}, required: [] },
          output: {
            example: {
              nav_usd: 1.234567,
              eth_price_usd: 3450.12,
              crash_shield_active: false,
              slippage_buffer_pct: 2.5,
              slippage_reason: "normal",
              basket: [
                {
                  token: "0x4200000000000000000000000000000000000006",
                  is_stable: false,
                  base_weight_pct: 50,
                  dynamic_weight_pct: 50,
                  slashed: false,
                  pool_fee_bps: 500,
                },
              ],
              meta: {
                contract: "0x36C81d7E1966310F305eA637e761Cf77F90852f0",
                chain: "base",
                chain_id: 8453,
                as_of_unix: 1747600000,
              },
            },
          },
        }),
      },
    },
    "/api/x402/quote": {
      accepts: accepts("$0.001"),
      description:
        "Preview a GBLIN swap (buy ETH→GBLIN or sell GBLIN→ETH) with dynamic slippage and a MEV-safe minOut.",
      mimeType: "application/json",
      extensions: {
        ...declareDiscoveryExtension({
          input: { direction: "buy", amount: "0.01" },
          inputSchema: {
            type: "object",
            properties: {
              direction: {
                type: "string",
                enum: ["buy", "sell"],
                description: "Swap direction: buy = ETH→GBLIN, sell = GBLIN→ETH",
              },
              amount: {
                type: "string",
                description: "Input amount as a decimal string (ETH for buy, GBLIN for sell)",
              },
            },
            required: ["direction", "amount"],
          },
          output: {
            example: {
              direction: "buy",
              amount_in_eth: "0.01",
              expected_gblin_out: "27.853214",
              safe_min_gblin_out: "27.156885",
              fees: {
                founder_eth: "0.000005",
                stability_eth: "0.000005",
                total_fee_bps: 10,
              },
              slippage_buffer_bps: 250,
              slippage_reason: "normal",
              next_step:
                "Call contract.buyGBLIN(safe_min_gblin_out) with msg.value = amount_in_eth.",
            },
          },
        }),
      },
    },
    "/api/x402/jit": {
      accepts: accepts("$0.005"),
      description:
        "Just-In-Time GBLIN→USDC calldata. Returns ready-to-broadcast atomic-swap calldata sized to cover the requested USDC amount.",
      mimeType: "application/json",
      extensions: {
        ...declareDiscoveryExtension({
          input: { usdc: "0.50", wallet: "0x0000000000000000000000000000000000000001" },
          inputSchema: {
            type: "object",
            properties: {
              usdc: {
                type: "string",
                description: "USDC amount needed (decimal string)",
              },
              wallet: {
                type: "string",
                description: "Agent EOA / smart-account 0x address (for cooldown check)",
              },
            },
            required: ["usdc", "wallet"],
          },
          output: {
            example: {
              action: "single_atomic_tx",
              target_contract: "0x36C81d7E1966310F305eA637e761Cf77F90852f0",
              calldata: "0x5d2e1ca7…",
              value: "0",
              params: {
                gblin_amount: "0.412345",
                target_token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                pool_fee: 500,
                min_usdc_out: "0.487500",
              },
              expected: {
                usdc_out: "0.500000",
                nav_used_usd: 1.234567,
                slippage_buffer_pct: 2.5,
                slippage_reason: "normal",
              },
              compatibility: { eoa: true, erc4337: true, eip7702: true },
              gas_hint: 600000,
            },
          },
        }),
      },
    },
    "/api/x402/invest": {
      accepts: accepts("$0.002"),
      description:
        "USDC→GBLIN treasury-accumulation calldata: two sequential steps (approve USDC, then buyGBLINWithToken) with MEV-safe minOut.",
      mimeType: "application/json",
      extensions: {
        ...declareDiscoveryExtension({
          input: { usdc: "10" },
          inputSchema: {
            type: "object",
            properties: {
              usdc: {
                type: "string",
                description: "USDC amount to invest into GBLIN (decimal string)",
              },
            },
            required: ["usdc"],
          },
          output: {
            example: {
              action: "sequential_txs",
              steps: [
                {
                  step: 1,
                  description: "Approve GBLIN contract to spend USDC",
                  target: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                  calldata: "0x095ea7b3…",
                  value: "0",
                },
                {
                  step: 2,
                  description:
                    "Buy GBLIN with USDC via native contract function",
                  target: "0x36C81d7E1966310F305eA637e761Cf77F90852f0",
                  calldata: "0x4f5d3a7b…",
                  value: "0",
                },
              ],
              expected: {
                usdc_in: "10",
                weth_min: "0.002824",
                gblin_expected: "8.121345",
                gblin_min: "7.918310",
                slippage_buffer_pct: 2.5,
                slippage_reason: "normal",
              },
              security: { mev_protected: true, min_outs_set: true },
            },
          },
        }),
      },
    },
    "/api/x402/health": {
      accepts: accepts("$0.002"),
      description:
        "Wallet treasury health: GBLIN/USDC/ETH balances, gas runway, and rebalance recommendation. Critical for autonomous decision-making.",
      mimeType: "application/json",
      extensions: {
        ...declareDiscoveryExtension({
          input: {
            wallet: "0x0000000000000000000000000000000000000001",
            daily_burn: "1.5",
          },
          inputSchema: {
            type: "object",
            properties: {
              wallet: {
                type: "string",
                description: "Agent 0x address",
              },
              daily_burn: {
                type: "string",
                description: "Optional average daily USD spend, used to compute runway",
              },
            },
            required: ["wallet"],
          },
          output: {
            example: {
              wallet: "0x0000000000000000000000000000000000000001",
              balances: {
                gblin: "42.123456",
                gblin_value_usd: 51.987654,
                usdc: "3.500000",
                eth: "0.001234",
                eth_value_usd: 4.2562,
                total_usd: 59.7438,
              },
              ratios: { gblin_pct: 87.02, usdc_pct: 5.86 },
              gas_health: {
                status: "sufficient",
                eth_balance: "0.001234",
                warning: null,
              },
              cooldown: {
                active: false,
                seconds_remaining: 0,
                last_deposit_unix: 1747500000,
              },
              recommendation: {
                target_gblin_pct: 90,
                target_usdc_pct: 10,
                action: "hold",
                runway_days: 2,
                reasoning:
                  "Low burn rate ($1.5/day): maximize GBLIN exposure (90%) for treasury yield. JIT-swap on demand.",
              },
            },
          },
        }),
      },
    },
    "/api/x402/governance": {
      accepts: accepts("$0.001"),
      description:
        "GBLIN protocol governance state: owner, 48h immutable timelock parameters, and any pending operation.",
      mimeType: "application/json",
      extensions: {
        ...declareDiscoveryExtension({
          input: {},
          inputSchema: { type: "object", properties: {}, required: [] },
          output: {
            example: {
              gblin_v6: "0x36C81d7E1966310F305eA637e761Cf77F90852f0",
              owner: "0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd",
              owner_is_timelock: true,
              owner_is_renounced: false,
              founder_wallet: "0x0000000000000000000000000000000000000002",
              trust_summary:
                "Ownership held by the 48h Timelock. All admin actions are delay-enforced on-chain.",
              timelock: {
                address: "0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd",
                min_delay_seconds: 172800,
                min_delay_hours: 48,
                min_delay_matches_expected: true,
                expected_min_delay_seconds: 172800,
              },
              verification: {
                gblin_v5_basescan:
                  "https://basescan.org/address/0x36C81d7E1966310F305eA637e761Cf77F90852f0#readContract",
                timelock_basescan:
                  "https://basescan.org/address/0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd#readContract",
              },
            },
          },
        }),
      },
    },
    "/api/x402/attestation": {
      accepts: accepts("$0.003"),
      description:
        "GBLIN Risk Attestation: a perishable (10-minute), verifiable proof of the current BTC/ETH risk regime (calm | elevated | crash) derived from the on-chain Crash Shield. Attach it to your action as proof-of-diligence; any counterparty verifies it in one step (EIP-712 signature when configured, else tamper-evident id). Free verifier: verify_risk_attestation in @gblin-protocol/mcp-server.",
      mimeType: "application/json",
      extensions: {
        ...declareDiscoveryExtension({
          input: {},
          inputSchema: { type: "object", properties: {}, required: [] },
          output: {
            example: {
              attestation: {
                regime: "calm",
                regime_code: 0,
                risk_posture: "risk_on",
                severity_pct: 0,
                severity_bps: 0,
                defensive_cash_pct: 10,
                shield_active: false,
                block_number: 34567890,
                issued_at: 1747600000,
                expires_at: 1747600600,
                ttl_seconds: 600,
                basket_hash: "0xabcd…",
                chain_id: 8453,
                contract: "0x36C81d7E1966310F305eA637e761Cf77F90852f0",
              },
              attestation_id: "0x9f1c…",
              signature: "0x… (present when attestor key configured, else null)",
              attestor: "0x… (published GBLIN attestor, else null)",
              signed: false,
              verify: {
                free_mcp_tool:
                  "npx @gblin-protocol/mcp-server → verify_risk_attestation",
              },
            },
          },
        }),
      },
    },
  },
  server,
  PAYWALL_CONFIG,
  paywall
);

export const middleware = x402Middleware;

export const config = {
  matcher: [
    "/api/x402/treasury-state",
    "/api/x402/quote",
    "/api/x402/jit",
    "/api/x402/invest",
    "/api/x402/health",
    "/api/x402/governance",
    "/api/x402/attestation",
  ],
  runtime: "nodejs",
};
