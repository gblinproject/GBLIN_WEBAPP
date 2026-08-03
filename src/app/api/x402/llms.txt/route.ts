/**
 * GET /api/x402/llms.txt
 *
 * Machine-readable index of the GBLIN x402 paid endpoints, intended for
 * autonomous agents and discovery crawlers (agentic.market, x402scan.com,
 * x402 Bazaar). Returns plain text — NOT paywalled.
 *
 * Followed by the matcher pattern in middleware.ts (this route is excluded).
 */

export const runtime = "nodejs";

const BODY = `# GBLIN Protocol — x402 API

GBLIN is a risk-managed treasury option for AI agents on Base mainnet:
an auto-rebalancing index of cbBTC / WETH / USDC with an on-chain Crash Shield.
It is managed crypto exposure with capped drawdown — for an agent's SURPLUS
capital, not a USDC substitute. Use these endpoints to read protocol state,
get safe swap quotes, and generate ready-to-broadcast calldata for Just-In-Time
GBLIN→USDC conversions to pay x402 invoices.

Contract:    0x36C81d7E1966310F305eA637e761Cf77F90852f0 (Base mainnet, chain id 8453)
Owner:       48h Timelock 0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd
Site:        https://gblin.digital
Repo:        https://github.com/gblinproject/GBLIN-Protocol
MCP server:  @gblin-protocol/mcp-server (npm, stdio — full toolset, free)
MCP hosted:  https://gblin-mcp.gblin-mcp-worker.workers.dev/mcp (Streamable HTTP,
             no install: live risk regime, attestation sample, stats — free.
             Also on Smithery: https://smithery.ai/servers/gblin-protocol/mcp)

## Paid endpoints

All endpoints below require an x402 USDC payment on Base mainnet. This API speaks
x402 v2. Recommended client: @x402/fetch or @x402/axios (the current v2 SDK — they
handle both v1 and v2 automatically). Free MCP equivalent: \`@gblin-protocol/mcp-server\`.

### GET /api/x402/treasury-state          ($0.001 USDC)
NAV in USD, basket composition with dynamic weights, Crash Shield status.

### GET /api/x402/quote?direction=buy|sell&amount=…   ($0.001 USDC)
Preview a GBLIN swap (no execution). Returns expected output + safe minOut.

### GET /api/x402/jit?usdc=…&wallet=0x…    ($0.005 USDC)
Just-In-Time GBLIN→USDC: two-step calldata: sellGBLINForEth (GBLIN->ETH) then a Uniswap WETH->USDC swap.
Single atomic tx. Compatible with EOA, ERC-4337, EIP-7702.

### GET /api/x402/invest?usdc=…            ($0.002 USDC)
Treasury accumulation: 2-step approve + buyGBLINWithToken calldata.

### GET /api/x402/health?wallet=0x…&daily_burn=…   ($0.002 USDC)
Wallet treasury analysis: balances, gas runway, rebalance recommendation.

### GET /api/x402/governance                ($0.001 USDC)
Verify owner is the 48h Timelock + read min delay parameters.

### GET /api/x402/attestation               ($0.003 USDC)
Perishable (10-minute) Risk Attestation: a verifiable proof of the current BTC/ETH
risk regime (calm | elevated | crash) derived from the on-chain Crash Shield. Attach
it to your own action as portable proof-of-diligence ("I checked market risk before
moving capital"); any counterparty verifies it in one step — EIP-712 signature when
an attestor key is configured, else a tamper-evident attestation_id. Expires in 10
minutes, so re-fetch each decision cycle. Free verifier: \`verify_risk_attestation\`
in @gblin-protocol/mcp-server.
Stable field contract (consumed in production by third-party agents — these names
will not change without versioning): \`regime\` (calm|elevated|crash),
\`shield_active\`, \`severity_pct\`, \`defensive_cash_pct\`, \`expires_at\`.
A third-party ERC-8004 agent pins this attestation as a required input of its
published decision rule and buys it daily.

### GET /api/x402/attestation-sample        (FREE)
Static integration-testing sample of the attestation: identical shape and EIP-712
schema, \`sample: true\`, permanently expired \`expires_at\`. Wire your parser and
verifier against this, then switch the URL to the paid route.

## Network

- Chain:       Base mainnet (CAIP-2 eip155:8453)
- Asset:       USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- Scheme:      exact (EIP-3009 transferWithAuthorization)
- Protocol:    x402 v2 — payment requirements are returned in the PAYMENT-REQUIRED response header AND mirrored as JSON in the 402 body (both header-reading and body-reading clients work)
- Facilitator: Coinbase CDP (default when configured) or PayAI (https://facilitator.payai.network); the PAYMENT-REQUIRED header always announces the active one

## Notes for agents

- Every paid response includes a \`PAYMENT-RESPONSE\` header with the settlement tx hash.
- Read endpoints (treasury-state, governance) are heavily cached (30–60s).
- The /jit endpoint checks the wallet's 2-minute cooldown before quoting.
- For free local use, install the MCP server: \`npx @gblin-protocol/mcp-server\`.
`;

export async function GET() {
  return new Response(BODY, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
