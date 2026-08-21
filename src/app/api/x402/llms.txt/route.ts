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

GBLIN is a basket token for AI-agent treasuries on Base mainnet:
an auto-rebalancing index of cbBTC / WETH / USDC with an on-chain Crash Shield
(rules-based weight cuts during drawdowns). It is crypto exposure with a coded
drawdown response — NOT capital-protected, NOT a USDC substitute; for an agent's
SURPLUS capital only. Use these endpoints to read protocol state,
get safe swap quotes, and generate ready-to-broadcast calldata for Just-In-Time
GBLIN→USDC conversions to pay x402 invoices.

Contract:    0x36C81d7E1966310F305eA637e761Cf77F90852f0 (Base mainnet, chain id 8453)
Owner:       48h Timelock 0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd
Site:        https://gblin.digital
Repo:        https://github.com/gblinproject/GBLIN-Protocol
MCP server:  @gblin-protocol/mcp-server (npm, stdio — full toolset, free)
MCP hosted:  https://gblin-mcp.gblin-mcp-worker.workers.dev/mcp (Streamable HTTP,
             no install, 8 free tools — a DIFFERENT set from the stdio package:
             risk.regime · risk.attestation_sample · protocol.stats ·
             protocol.info · coherence.report · receipts.seal (demo) ·
             receipts.get · receipts.verify (old flat names still work as aliases). Resources: gblin://howto/attestation, gblin://howto/seal,
             gblin://limits, gblin://keys (60 req/min/IP). Nothing is paid over MCP.
             GET audit: /meta · /tools.json · /resources.json · /conformance · /v1/verify/:i
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
published decision rule and bought it daily until 16 Aug 2026 (their settlement step then stopped for every vendor; see gblin.digital/receipts).

### POST /api/x402/seal                     ($0.01)
AI ACTION RECEIPTS — seal the HASHES of an AI action into GBLIN's public,
signed append-only transparency log (origin: gblin.digital/receipts-log).
Body: {action, input_hash(sha256 hex), output_hash?, agent_id?, tool?, meta?<=512ch}.
PRIVACY: input/output go in as hashes only; the action/agent_id/tool/meta
strings you send are published in the public log — identifiers, never secrets.
Returns a portable receipt: Ed25519 signature + RFC 6962 inclusion proof +
C2SP signed checkpoint; the tree root is anchored daily on Base via EAS.
A seal proves existence and time — it is NOT a compliance certificate and
NOT an endorsement of the content. The checkpoint is signed by the log
operator; independent witness cosigning is an open invitation.
Free demo (5/day/IP, marked demo:true): POST gblin-mcp.gblin-mcp-worker.workers.dev/v1/seal-demo
Read free forever: /v1/receipt/:index · /log/checkpoint · /log/proof/:index · human page /receipt/:index
Offline verifier (zero deps): verify-receipt.mjs in github.com/gblinproject/gblin-treasury-risk-regime
MCP tools (hosted): receipts.seal (demo) · receipts.get · receipts.verify · resource gblin://howto/seal

Attestor address (pin this): 0x3ae65d36e8b1d82B0B80669E769A3dc300D543e4
Every paid attestation is signed by it; a signature recovering to another address is not ours.

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
