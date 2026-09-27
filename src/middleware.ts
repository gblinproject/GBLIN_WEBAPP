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
 *                            • note: x402.org is testnet only
 *
 * Pricing: micropayments calibrated for autonomous agent budgets.
 */

import type { NextRequest } from "next/server";
import type { Address } from "viem";
import { paymentProxy } from "@x402/next";
import { PaywallBuilder, evmPaywall } from "@x402/paywall";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
// Side-effect import of the package ROOT: @x402/next dynamically imports
// '@x402/extensions' at runtime; without this static reference the Next
// bundler omits it and cold starts log ERR_MODULE_NOT_FOUND.
import "@x402/extensions";
import {
  declareDiscoveryExtension,
  bazaarResourceServerExtension,
} from "@x402/extensions/bazaar";
import { createFacilitatorConfig } from "@coinbase/x402";
import treasuryStateOutputContract from "@/lib/treasury-state-output-contract.json";

const PAY_TO = (process.env.X402_PAY_TO_WALLET ?? "") as Address;

// Soft-warn at build time if the recipient wallet is missing. Throwing is
// avoided on purpose: Next.js evaluates middleware during `next build`, and a
// build has to succeed without secrets (preview deployments).
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
// signs every verify/settle call with the configured CDP key — required by CDP.
const cdpKeyId = process.env.CDP_API_KEY_ID;
const cdpKeySecret = process.env.CDP_API_KEY_SECRET;
// CDP is the DEFAULT when keys are present: only CDP-settled payments are
// indexed by the x402 Bazaar (discovery + ranking). The 401 affects
// getSupported() only and is contained by ResilientFacilitatorClient below, so
// verify/settle can run against CDP.
// Rollback without a code change: X402_ENABLE_CDP="false" selects the fallback.
const useCdp =
  !!cdpKeyId && !!cdpKeySecret && process.env.X402_ENABLE_CDP !== "false";
/**
 * Facilitator client with a resilient getSupported().
 * The CDP /supported route can answer 401 to the SDK auth headers, while
 * verify/settle use per-request signed headers and are unaffected. Without
 * supported kinds, buildPaymentRequirements() throws "Facilitator does not
 * support exact on eip155:8453" on every request. The real call is therefore
 * attempted first and, on failure, the statically known CDP capabilities are
 * returned so initialize() always succeeds.
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
// payment payload — required for the CDP facilitator to catalog the route in
// the Bazaar after the first successful settlement.
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
    // A route that does not declare `extensions.bazaar` is not a candidate for
    // indexing at all: that declaration is what carries enough information for
    // the Bazaar to index the route.
    "/api/x402/catalog": {
      accepts: accepts("$0.005"),
      description:
        "Call before your agent pays an x402 service it has not used recently: is that endpoint actually alive? Liveness of the ~200 most recently updated Bazaar listings, probed in rotation (each about every 36h): HTTP status, latency, last-OK time and consecutive failures per endpoint. Measurements only, no judgements; the probes never pay. Free aggregate view: gblin-mcp.gblin-mcp-worker.workers.dev/catalog",
      mimeType: "application/json",
      extensions: {
        ...declareDiscoveryExtension({
          input: {},
          inputSchema: { type: "object", properties: {}, required: [] },
          output: {
            example: {
              probed: 200,
              alive: 198,
              cadence_hours: 2,
              sample: [
                {
                  resource: "https://example.com/api/paid",
                  http: 402,
                  latency_ms: 143,
                  last_ok: "2026-08-30T09:00:00.000Z",
                  consecutive_fails: 0,
                },
              ],
            },
          },
        }),
      },
    },
    // The route key MUST carry the HTTP verb. A key without one is parsed as
    // method "*", so payment is required and settled on every method: this
    // route serves POST only, and a paid GET would end on a 405 — charged, with
    // nothing in return. Any component that mirrors this challenge for the
    // other methods has to declare the same thing, or the two diverge and the
    // golden fixtures fail.
    "POST /api/x402/seal": {
      accepts: accepts("$0.0045"),
      description:
        "Call after your agent completes an action it may later have to prove: seal the hashes of its input and output (only your action label and meta are published) into GBLIN's signed append-only transparency log and get a portable receipt: Ed25519 signature, RFC 6962 inclusion proof, C2SP signed checkpoint; root anchored daily on Base (EAS). Proves existence and time, not correctness. Free reads and demo: gblin-mcp.gblin-mcp-worker.workers.dev/log",
      mimeType: "application/json",
      extensions: {
        ...declareDiscoveryExtension({
          bodyType: "json", // the HTTP method is filled in by bazaarResourceServerExtension
          input: {
            action: "summarise-contract",
            input_hash:
              "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          },
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                maxLength: 128,
                description:
                  "Short public label for what the AI did. PUBLISHED in the log: identifiers only, never secrets.",
              },
              input_hash: {
                type: "string",
                pattern: "^(0x)?[0-9a-fA-F]{64}$",
                description: "sha256 of your input, 64 hex chars (0x prefix optional)",
              },
              output_hash: {
                type: "string",
                pattern: "^((0x)?[0-9a-fA-F]{64})?$",
                description: "sha256 of your output, 64 hex chars (optional)",
              },
              agent_id: {
                type: "string",
                maxLength: 128,
                description: "Your agent identifier (optional). PUBLISHED.",
              },
              tool: {
                type: "string",
                maxLength: 128,
                description: "Tool or model used (optional). PUBLISHED.",
              },
              meta: {
                type: "string",
                maxLength: 512,
                description: "Extra JSON object as a string (optional). PUBLISHED.",
              },
            },
            required: ["action", "input_hash"],
          },
          output: {
            example: {
              format: "gblin-receipt/v1",
              payload: {
                v: 1,
                log: "gblin.digital/receipts-log",
                index: 42,
                ts: "2026-08-30T09:00:00.000Z",
                action: "summarise-contract",
                input_hash:
                  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                output_hash: null,
              },
              leaf: "<base64 sha256(0x00 || canonical)>",
              index: 42,
              tree_size: 43,
              root: "<base64 Merkle root>",
              signature: "<base64 Ed25519 over the canonical record>",
              verifier_key: "gblin.digital/receipts-log+00c6e18c+...",
              inclusion_proof: ["<base64 node>", "<base64 node>"],
              checkpoint: "<C2SP signed note>",
              verify:
                "offline: see verify-receipt.mjs in github.com/gblinproject/gblin-treasury-risk-regime (zero deps)",
            },
          },
        }),
      },
    },
    "/api/x402/attestation": {
      accepts: accepts("$0.003"),
      // Keep this description under 512 characters: above that limit the CDP
      // facilitator rejects payment verification with HTTP 400.
      description:
        "Call before your agent trades, rebalances or moves capital: is the crypto market calm, elevated or in a crash regime right now? Returns a 10-minute, EIP-712-signed risk attestation for BTC and ETH computed from Chainlink prices and the on-chain shield rule, with severity and a defensive cash share. Any counterparty verifies it offline in one step. Free sample: /api/x402/attestation-sample; free verifier in the MCP server.",
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
                contract: "0xc2181d975c05c8c724b334bcED0764c0b86B1D53",
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

// No paid route takes query parameters any more (the six vault-state routes that did were made
// free on 2026-09-27), so the parameter guard that used to run before verify/settle is gone.
// A caller with bad input on a free route is answered by the route handler itself.

/**
 * In-memory cache of unpaid 402 responses (per path, per Accept flavor).
 *
 * Most of the compute spent by this middleware comes from crawlers and agents
 * (catalog indexers, discovery probes) GETting the paid endpoints WITHOUT a
 * payment, and the 402 they receive is deterministic per path: the exact-scheme
 * `accepts[]` requirements contain no nonce and no timestamp (the EIP-3009
 * nonce and validity window are generated client-side when the agent signs).
 * Each 402 is therefore built once per warm instance and replayed, instead of
 * re-running the full paywall pipeline on every probe. Requests that DO carry a
 * payment header always go through the real pipeline.
 */
const PAYMENT_HEADERS = ["payment-signature", "x-payment"] as const;
// 60 min: the 402 is deterministic per path and the requirements only change on
// deploy — and a deploy recycles the instances together with their in-memory
// cache.
const CACHE_402_TTL_MS = 60 * 60 * 1000;
const cache402 = new Map<string, { expires: number; status: number; headers: [string, string][]; body: ArrayBuffer }>();

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  // A request that carries a payment header goes through the real x402 pipeline; anonymous
  // GETs on the canonical form are served from the in-memory 402 cache below.
  const isPaying = PAYMENT_HEADERS.some((h) => req.headers.get(h));
  const hasPayment = isPaying;
  const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
  const cacheKey = `${url.pathname}:${wantsHtml ? "html" : "json"}`;

  // The challenge ECHOES the full URL in `resource.url`, query string included,
  // while the cache key above only looks at the path. Caching a response built
  // for `?direction=buy&amount=100` would answer every parameter-free request
  // for an hour with a challenge declaring a `resource` other than the one
  // requested: non-deterministic bytes, and those are exactly the bytes the
  // Bazaar indexes. Only the canonical form without a query is cached, which is
  // the form crawlers, the validator and the golden fixtures see. A request
  // carrying a query is computed every time: there are few of them, and keying
  // the cache on the full URL would allow unbounded keys.
  const cacheable = url.search === "";

  if (!hasPayment && req.method === "GET" && cacheable) {
    const hit = cache402.get(cacheKey);
    if (hit && hit.expires > Date.now()) {
      return new Response(hit.body.slice(0), { status: hit.status, headers: hit.headers });
    }
  }

  let res: Response = await x402Middleware(req);

  // The x402 spec expects the payment challenge in BOTH the PAYMENT-REQUIRED
  // header and the response body; @x402/next emits it header-only, so
  // body-reading clients fail closed. Mirror the decoded header into the body —
  // only when the body is empty, so a rendered HTML paywall (if any) is never
  // replaced. The HTML flavor also returns an empty `{}` body, so the mirror
  // applies to both flavors.
  if (res.status === 402) {
    const header = res.headers.get("payment-required");
    if (header) {
      try {
        const bodyText = (await res.clone().text()).trim();
        if (bodyText === "" || bodyText === "{}") {
          const challenge = Buffer.from(header, "base64").toString("utf-8");
          const parsed = JSON.parse(challenge); // mirror only if the header decodes to valid JSON
          // Breadcrumb for whoever is reading this 402 in a terminal or a log: one
          // additive, non-required, namespaced field. BODY ONLY — the header (what
          // clients verify and sign against) stays byte-identical, and none of the
          // spec fields (accepts[], resource, x402Version) are touched.
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            parsed.gblin_info = {
              docs: "https://gblin.digital/api/x402/llms.txt",
              free_market_risk_regime: "https://gblin-mcp.gblin-mcp-worker.workers.dev/regime",
              x402_uptime_observatory: "https://gblin-mcp.gblin-mcp-worker.workers.dev/observatory",
              note: "Reading is free; only the paid resource above requires payment.",
            };
          }
          const headers = new Headers(res.headers);
          headers.set("content-type", "application/json");
          res = new Response(JSON.stringify(parsed), { status: 402, headers });
        }
      } catch {
        // mirroring is best-effort; never break the live response
      }
    }
  }

  if (!hasPayment && req.method === "GET" && res.status === 402 && cacheable) {
    try {
      const clone = res.clone();
      const body = await clone.arrayBuffer();
      cache402.set(cacheKey, {
        expires: Date.now() + CACHE_402_TTL_MS,
        status: res.status,
        headers: [...res.headers.entries()],
        body,
      });
    } catch {
      // caching is best-effort; never break the live response
    }
  }

  return res;
}

export const config = {
  // Only the three paid routes. treasury-state, quote, jit, invest, health and governance are
  // free since 2026-09-27 and must not pass through the payment middleware.
  matcher: [
    "/api/x402/catalog",
    "/api/x402/attestation",
    "/api/x402/seal",
  ],
  runtime: "nodejs",
};
