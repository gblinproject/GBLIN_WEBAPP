# GBLIN Protocol — Web App

Front-end and dApp for **GBLIN**, an on-chain index on Base mainnet (45% cbBTC + 45% WETH + 10% USDC) with an algorithmic Crash Shield and AI-agent-native treasury tooling.

## Trust & Governance

**GBLIN_V5 is now owned by a 48-hour Timelock Controller** — every admin action (parameter change, oracle update, ownership transfer) is enforced on-chain to wait `172,800 seconds` before it can be executed. Verifiable end-to-end on BaseScan.

| Component | Address |
|---|---|
| **GBLIN_V5 token** | [`0x38DcDB3A381677239BBc652aed9811F2f8496345`](https://basescan.org/address/0x38DcDB3A381677239BBc652aed9811F2f8496345) |
| **Timelock Controller** | [`0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd`](https://basescan.org/address/0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd) |
| **Ownership transfer tx** | [`0xb653f54ffa9b1764b41932e6a411077e7e34550605303f15d90900de682edaaf`](https://basescan.org/tx/0xb653f54ffa9b1764b41932e6a411077e7e34550605303f15d90900de682edaaf) |

Properties enforced at the contract level (see `contracts/GblinTimelockController.sol`):

- `MIN_DELAY` is **immutable** — the `updateDelay` override permanently reverts, eliminating the rug-then-attack vector.
- `PROPOSER_ROLE` and `CANCELLER_ROLE` are **strictly separated** — the constructor reverts if any address holds both.
- `EXECUTOR_ROLE` is open (`address(0)`) — anyone can execute a matured operation, anti-censorship.
- `DEFAULT_ADMIN_ROLE` is held by the timelock itself — every role/config change must itself go through the 48h delay.
- `GRACE_PERIOD` of 14 days — pending operations expire if not executed in time (no zombie proposals).

AI-agent integrators can verify all of this on-chain in one call via the `get_governance_state` MCP tool. See the [GBLIN MCP repo](https://github.com/gblinproject/GBLIN-MCP).

## x402 — Pay-per-call API for AI Agents

GBLIN ships **6 paid HTTP endpoints** under [`/api/x402/*`](https://gblin.digital/api/x402/llms.txt) that any autonomous agent can consume by paying USDC on Base mainnet. No API keys, no signups, no account: agents pay per call via the [x402 protocol v2](https://x402.org), settle through the Coinbase CDP facilitator, and receive the response in the same HTTP round-trip.

| Endpoint | Price (USDC) | Returns |
|---|---|---|
| `GET /api/x402/treasury-state` | $0.001 | Live NAV, basket weights, Crash Shield status |
| `GET /api/x402/quote` | $0.001 | Buy/sell preview with MEV-safe `minOut` and dynamic slippage |
| `GET /api/x402/governance` | $0.001 | Owner, timelock parameters, trust summary |
| `GET /api/x402/health` | $0.002 | Wallet GBLIN/USDC/ETH balances, gas runway, rebalance hint |
| `GET /api/x402/invest` | $0.002 | USDC→GBLIN sequential calldata (approve + buy) |
| `GET /api/x402/jit` | $0.005 | Just-In-Time GBLIN→USDC atomic-swap calldata |

**Properties:**

- **Gasless on the buyer side** — agents sign an EIP-3009 `transferWithAuthorization`; the facilitator pays the on-chain gas in ETH, the agent only spends USDC.
- **Listed in the [Coinbase Bazaar](https://docs.cdp.coinbase.com/x402/bazaar)** — discoverable from any x402-aware client without manual configuration.
- **Strict input validation + JSON Schemas** — every endpoint exposes `info.input` / `info.output` examples so agents can synthesize correct calls from metadata alone.
- **Public discovery manifest** at [`/api/x402/llms.txt`](https://gblin.digital/api/x402/llms.txt) — kept free for crawlers and LLMs.

The middleware is a single file: [`src/middleware.ts`](src/middleware.ts). Each route handler lives in `src/app/api/x402/<name>/route.ts` and contains zero payment logic — the paywall is enforced upstream by `paymentProxy` from `@x402/next`.

## ElizaOS Integration

For agents running on **ElizaOS**, the [`plugin-gblin`](https://www.npmjs.com/package/plugin-gblin) ([repo](https://github.com/gblinproject/GBLIN_PLUGIN)) consumes these x402 endpoints natively. It exposes 3 Actions (`CHECK_GBLIN_TREASURY_HEALTH`, `INVEST_IDLE_USDC_GBLIN`, `RESCUE_USDC_FROM_GBLIN`) and 1 Provider (`GBLIN_TREASURY_CONTEXT`) — install via `npm install plugin-gblin`.

## Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies: `npm install`
2. Copy the example env file: `cp .env.example .env.local`
3. Fill in `MORALIS_API_KEY`, `X402_PAY_TO_WALLET`, and optionally `CDP_API_KEY_*` in `.env.local`
4. Run the dev server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

To build for production: `npm run build`
