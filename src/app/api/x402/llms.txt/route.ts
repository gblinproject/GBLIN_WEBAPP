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
MCP server:  @gblin-protocol/mcp-server (npm)

## Paid endpoints

All endpoints below require an x402 USDC payment on Base mainnet. Recommended
client: Coinbase x402-fetch or x402-axios. Free MCP equivalent: \`@gblin-protocol/mcp-server\`.

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

## Network

- Chain:      Base mainnet (8453)
- Asset:      USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- Scheme:     exact (EIP-3009 transferWithAuthorization)
- Facilitator: Coinbase CDP (default)

## Notes for agents

- Every response includes \`X-PAYMENT-RESPONSE\` header with the settlement tx hash.
- Read endpoints (treasury-state, governance) are heavily cached (30–60s).
- The /jit endpoint checks the wallet's 2-minute cooldown before quoting.
- For free local use, install the MCP server: \`npx @gblin-protocol/mcp-server\`.
`;

export async function GET() {
  return new Response(BODY, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
