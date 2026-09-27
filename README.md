# GBLIN Protocol — Web App

[![Base MCP Plugin](https://img.shields.io/badge/Base%20MCP-PR%20%2356-blue)](https://github.com/base/skills/pull/56)
[![x402 Manifest](https://img.shields.io/badge/x402-manifest-green)](https://gblin.digital/.well-known/x402)
[![x402 conformance](https://api.stelardigital.com/badge/conformance.svg?url=https%3A%2F%2Fgblin.digital%2Fapi%2Fx402%2Fattestation)](https://stelardigital.com/x402-doctor?url=https%3A%2F%2Fgblin.digital%2Fapi%2Fx402%2Fattestation)
[![Base Mainnet](https://img.shields.io/badge/Base-Mainnet%20Live-0052FF)](https://basescan.org/address/0xc2181d975c05c8c724b334bcED0764c0b86B1D53)

Front-end and dApp for **GBLIN**, an on-chain index on Base mainnet (45% cbBTC + 45% WETH + 10% USDC) with an algorithmic Crash Shield and AI-agent-native treasury tooling.

## Trust & Governance

**The GBLIN vault is governed by a 48-hour Timelock Controller** — every admin action (parameter change, oracle update, ownership transfer) is enforced on-chain to wait `172,800 seconds` before it can be executed. The vault in service and its sequencer sentinel have been owned by the timelock since 22 September 2026 (`owner()` returns the timelock, `pendingOwner()` returns zero). Verifiable end-to-end on BaseScan.

| Component | Address |
|---|---|
| **GBLIN vault** | [`0xc2181d975c05c8c724b334bcED0764c0b86B1D53`](https://basescan.org/address/0xc2181d975c05c8c724b334bcED0764c0b86B1D53) |
| **Timelock Controller** | [`0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd`](https://basescan.org/address/0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd) |
| **Ownership accepted (vault)** | [`0x366dc55dfe1fc3a1eb662a245ed7f5e6b54c68a0621124eafe5cf14188a2503c`](https://basescan.org/tx/0x366dc55dfe1fc3a1eb662a245ed7f5e6b54c68a0621124eafe5cf14188a2503c) |

Properties enforced at the contract level (see `contracts/GblinTimelockController.sol`):

- `MIN_DELAY` is **immutable** — the `updateDelay` override permanently reverts, eliminating the rug-then-attack vector.
- `PROPOSER_ROLE` and `CANCELLER_ROLE` are **strictly separated** — the constructor reverts if any address holds both.
- `EXECUTOR_ROLE` is open (`address(0)`) — anyone can execute a matured operation, anti-censorship.
- `DEFAULT_ADMIN_ROLE` is held by the timelock itself — every role/config change must itself go through the 48h delay.
- `GRACE_PERIOD` of 14 days — pending operations expire if not executed in time (no zombie proposals).

AI-agent integrators can verify all of this on-chain in one call: the free `GET /api/x402/governance` endpoint, or the MCP tool `governance.state` (hosted) / `get_governance_state` (stdio). See the [GBLIN MCP repo](https://github.com/gblinproject/gblin-treasury-risk-regime).

## x402 — Pay-per-call API for AI Agents

Reading GBLIN's state and preparing its transactions is **free**. Three endpoints under [`/api/x402/*`](https://gblin.digital/api/x402/llms.txt) are **paid** per call in USDC on Base mainnet, over the [x402 protocol v2](https://x402.org), settled through the Coinbase CDP facilitator: no API key, no signup, no account.

**Paid** (HTTP 402 challenge, then the response in the same round-trip):

| Endpoint | Price (USDC) | Call it |
|---|---|---|
| `GET /api/x402/attestation` | $0.003 | before trading, rebalancing or moving capital: a 10-minute, EIP-712-signed market-risk attestation (calm / elevated / crash) |
| `POST /api/x402/seal` | $0.0045 | after an action you may have to prove: seals its hashes into the transparency log (see below) |
| `GET /api/x402/catalog` | $0.005 | before paying an x402 service you have not used recently: liveness of ~200 Bazaar listings |

Two more paid endpoints live on the Sentinel (`https://gblin-sentinel.vercel.app`): `/api/data/base-risk-pulse` ($0.002) and `/api/data/risk-pulse-pro` ($0.005).

**Free** (plain `GET`, JSON, cached at the CDN for 20-60 seconds):

| Endpoint | Returns |
|---|---|
| `GET /api/x402/treasury-state` | Live NAV, basket weights, Crash Shield status |
| `GET /api/x402/quote` | Buy/sell preview with `minOut` and dynamic slippage |
| `GET /api/x402/governance` | Owner, timelock parameters, trust summary |
| `GET /api/x402/health` | Wallet GBLIN/USDC/ETH balances, gas for an exit, redemption cooldown, USDC runway |
| `GET /api/x402/invest` | USDC→GBLIN calldata: approve + `GBLINZap.buyGBLINWithToken` |
| `GET /api/x402/jit` | GBLIN→USDC calldata: approve + `GBLINZap.sellGBLINForEth` + Uniswap WETH→USDC |

The paths keep the `/api/x402/` prefix so existing integrations do not break. The steps that go through the Zap carry an explicit `gas` limit: send them with it.

**Properties of the paid endpoints:**

- **Gasless on the buyer side** — agents sign an EIP-3009 `transferWithAuthorization`; the facilitator pays the on-chain gas in ETH, the agent only spends USDC.
- **Listed in the [Coinbase Bazaar](https://docs.cdp.coinbase.com/x402/bazaar)** — discoverable from any x402-aware client without manual configuration.
- **Strict input validation + JSON Schemas** — every challenge declares `extensions.bazaar` with input and output examples, so agents can synthesize correct calls from metadata alone.
- **Challenge served at the edge** — an anonymous request is answered by an edge worker with the same bytes the origin would send (pinned by the fixtures in [`test/x402-golden/`](test/x402-golden/)); a request carrying a payment header always reaches the origin.
- **Public discovery manifest** at [`/api/x402/llms.txt`](https://gblin.digital/api/x402/llms.txt) — kept free for crawlers and LLMs.

The middleware is a single file: [`src/middleware.ts`](src/middleware.ts); its matcher covers only the three paid paths. Each route handler lives in `src/app/api/x402/<name>/route.ts` and contains zero payment logic — the paywall is enforced upstream by `paymentProxy` from `@x402/next`.

## AI Action Receipts — prove what your agent did

Seal the **hashes** of any AI action (never the content) into GBLIN's public
append-only transparency log and get back a portable, offline-verifiable receipt.

- **Seal (paid, unlimited):** `POST /api/x402/seal` — $0.0045 USDC via x402 on Base.
  Body: `{action, input_hash, output_hash?, agent_id?, tool?, meta?}` (hashes = sha256 hex).
- **Demo (free, 5/day/IP):** `POST https://gblin-mcp.gblin-mcp-worker.workers.dev/v1/seal-demo`
  (receipts are marked `demo:true`), the hosted MCP tool `receipts.seal` with `mode: "demo"`, or
  `seal_action_demo` in the stdio server.
- **Read (free forever):** `/v1/receipt/:index`, `/log/checkpoint`, `/log/proof/:index`,
  human page `/receipt/:index` on the worker; log overview at
  [gblin-mcp.gblin-mcp-worker.workers.dev/log](https://gblin-mcp.gblin-mcp-worker.workers.dev/log).
- **Receipt =** canonical payload + Ed25519 signature + RFC 6962 inclusion proof +
  C2SP signed checkpoint. The tree root is **anchored daily on Base via EAS**
  (schema `0x9f433a96…`, promiseId `keccak256("gblin-receipts-log")`).
- **Verify offline, zero dependencies:** `verify-receipt.mjs` in
  [gblinproject/gblin-treasury-risk-regime](https://github.com/gblinproject/gblin-treasury-risk-regime).

A seal proves **existence and time** in a signed append-only log anchored daily
on Base. Input/output go in as hashes only; the `action` label, `agent_id`,
`tool` and `meta` strings you send are published in the public log — put
identifiers there, never secrets. It is **not** a compliance certificate and
**not** an endorsement of the content. The checkpoint is signed by the log
operator and cosigned by an independent witness (Markovian Protocol) under the
C2SP tlog-cosignature format: a cosignature attests that the log stayed
append-only between the sizes the witness saw, not that any receipt is true.

## Agent treasury — keep cash in USDC, surplus in GBLIN

[`@gblin-protocol/agent-treasury`](https://www.npmjs.com/package/@gblin-protocol/agent-treasury) is a self-custody library and CLI for an agent's wallet: operating cash stays in USDC, the surplus above a reserve is parked in GBLIN, and USDC is pulled back from GBLIN just in time when an x402 invoice arrives. The refill runs on the `onBeforePaymentCreation` hook of Coinbase's `x402Client`, before the payment is signed; a price above the per-payment cap is refused before anything is signed.

```bash
npx @gblin-protocol/agent-treasury status --json      # balances, reserve, surplus, regime
npx @gblin-protocol/agent-treasury park               # surplus above the reserve into GBLIN
npx @gblin-protocol/agent-treasury ensure-usdc 5      # exit GBLIN until the wallet holds 5 USDC
npx @gblin-protocol/agent-treasury pay <url>          # pay an x402 URL, refilling USDC if needed
```

The key is read from `GBLIN_AGENT_PRIVATE_KEY` and never leaves the process. Parking waits while the market regime is a crash or cannot be read; the refill never does. Balances reported after a move are read at the block of the last receipt. Agent skill: `npx skills add gblinproject/gblin-treasury-risk-regime` (`gblin-agent-treasury`). Source: [`packages/agent-treasury`](https://github.com/gblinproject/gblin-treasury-risk-regime/tree/main/packages/agent-treasury).

GBLIN is crypto exposure, not cash and not yield: park only the surplus you can hold through a drawdown.

## ElizaOS Integration

For agents running on **ElizaOS**, the [`plugin-gblin`](https://www.npmjs.com/package/plugin-gblin) ([repo](https://github.com/gblinproject/GBLIN_PLUGIN)) calls these endpoints natively. It exposes 3 Actions (`CHECK_GBLIN_TREASURY_HEALTH`, `INVEST_IDLE_USDC_GBLIN`, `RESCUE_USDC_FROM_GBLIN`) and 1 Provider (`GBLIN_TREASURY_CONTEXT`) — install via `npm install plugin-gblin`.

## Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies: `npm install`
2. Copy the example env file: `cp .env.example .env.local`
3. Fill in `ALCHEMY_API_KEY` (chain reads and activity history), `X402_PAY_TO_WALLET`, and optionally `CDP_API_KEY_*`, `BLOCKSCOUT_API_KEY` and `RELAYER_PRIVATE_KEY` (the GBLIN payment relay) in `.env.local`
4. Run the dev server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

To build for production: `npm run build`

## x402 Protocol Discovery

GBLIN exposes its x402 payment manifest at:

`https://gblin.digital/.well-known/x402`

This endpoint follows the x402 protocol discovery standard and returns a JSON manifest with:
- Chain ID and currency address (USDC on Base)
- Facilitator URL
- The paid x402 endpoints with their prices, and the free endpoints under `free_endpoints`
- Contract address and verification links

AI agents (Base MCP, ElizaOS, custom agents) can read this file to:
1. Auto-discover GBLIN's paid and free endpoints
2. Verify the protocol before initiating payment flows
3. Get the canonical contract address for the GBLIN token

The file is served as `application/json` via Next.js header config (see `next.config.js`).

## Base MCP Integration

GBLIN is integrated into the official Base MCP skill at:
- Plugin file: `skills/base-mcp/plugins/gblin.md`
- PR: https://github.com/base/skills/pull/56

The plugin teaches Base MCP agents how to invest USDC into GBLIN (approve + Zap, two calls), redeem just in time for an x402 payment (three calls) and check treasury health, all from the free endpoints.
