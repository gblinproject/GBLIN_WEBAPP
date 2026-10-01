# GBLIN x402 API

HTTP endpoints that expose the GBLIN protocol to autonomous agents. Reading state and
preparing transactions is free; three endpoints are paid per call in USDC on Base mainnet,
settled on-chain via the [x402](https://x402.org) protocol.

The same data is available over MCP:

|             | MCP server                                                        | HTTP API                                  |
| ----------- | ----------------------------------------------------------------- | ----------------------------------------- |
| Transport   | stdio (`npx @gblin-protocol/mcp-server`) or hosted Streamable HTTP | HTTPS                                     |
| Price       | free                                                              | free, except the three paid endpoints     |
| Discovery   | MCP Registry, Smithery                                            | x402 Bazaar, `.well-known/x402`, llms.txt |
| Code path   | `gblin-treasury-risk-regime/src/`                                 | `GBLIN_WEBAPP/src/app/api/x402/*`         |

## 1. Endpoints

Discovery manifests (free):

```
GET https://gblin.digital/api/x402/llms.txt
GET https://gblin.digital/.well-known/x402
```

Paid endpoints (HTTP 402 with the payment requirements on the first call, then the JSON
response on the retry that carries the payment header):

| Endpoint                     | Price        | Description                                                                          |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| `GET /api/x402/attestation`  | $0.003 USDC  | 10-minute, EIP-712-signed market-risk attestation (calm / elevated / crash)           |
| `POST /api/x402/seal`        | $0.0045 USDC | Seals the hashes of an AI action into the transparency log; returns a portable receipt |
| `GET /api/x402/catalog`      | $0.005 USDC  | Liveness of the ~200 most recently updated x402 Bazaar listings                      |

Free endpoints (plain `GET`, no payment, cached at the CDN for 20-60 seconds):

| Endpoint                        | Description                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /api/x402/treasury-state`  | NAV, basket weights, Crash Shield status                                             |
| `GET /api/x402/quote`           | Preview a buy or sell (no execution) with a dynamic slippage buffer                  |
| `GET /api/x402/governance`      | Whether the 48h timelock owns the vault, and its minimum delay                       |
| `GET /api/x402/health`          | Wallet balances, gas for an exit, redemption cooldown, USDC runway                   |
| `GET /api/x402/invest`          | USDC→GBLIN calldata: approve + `GBLINZap.buyGBLINWithToken`                          |
| `GET /api/x402/jit`             | GBLIN→USDC calldata: approve + `GBLINZap.sellGBLINForEth` + Uniswap WETH→USDC        |

The free paths keep the `/api/x402/` prefix so existing integrations keep working.
USDC payments go directly to the wallet defined by `X402_PAY_TO_WALLET`; the server never
holds funds.

## 2. How payments work

```
Agent (wallet) ──HTTP──▶ gblin.digital/api/x402/<paid path>
                          │
                          ├─ no payment header: 402 + payment requirements
                          │  (served at the edge, byte-identical to the origin)
                          │
Agent retries with the signed EIP-3009 authorization in the payment header
                          │
                          ├─ middleware asks the Coinbase CDP facilitator
                          │  to verify and settle on Base
                          │
                          ◀── JSON response + PAYMENT-RESPONSE header
                              (settlement transaction hash)
```

Payments are atomic: the route handler runs **after** the facilitator confirms the USDC
transfer. If verification fails, the response is still 402 and no work is done.

## 3. Setup

### 3.1 Environment variables (Vercel → Project → Settings → Environment)

```
X402_PAY_TO_WALLET=0xYourDedicatedTreasuryWallet
CDP_API_KEY_ID=cdp-key-uuid
CDP_API_KEY_SECRET=cdp-secret
```

Optional:

```
X402_FACILITATOR_URL=https://x402.org/facilitator   # only for testnet
GBLIN_RPC_URL=https://base-mainnet.g.alchemy.com/v2/your-key
```

### 3.2 Generate CDP credentials

1. Go to [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
2. Sign up with your email (free)
3. Create a new **API Key** (not Server Wallet)
4. Copy the **Key ID** and **Private Key** (shown only once)
5. Paste both into Vercel env vars

Free tier: 1,000 settled transactions per month. After that, $0.001 per tx
charged to your CDP account — independent from the USDC you collect.

### 3.3 Listing on discovery catalogs

Once deployed and the `/api/x402/llms.txt` endpoint returns 200 (catalogues index only the paid endpoints):

1. **agentic.market** — go to [agentic.market/validate](https://agentic.market/validate),
   paste `https://gblin.digital/api/x402/attestation`, click **Validate**.
2. **x402scan.com** — go to [x402scan.com/resources/register](https://x402scan.com/resources/register),
   paste the same URL, click **Add**.
3. **x402 Bazaar** — automatic. The Coinbase facilitator indexes a route after
   its first settled payment; a route with no settlement for 30 days is removed.
   The free validator `POST api.cdp.coinbase.com/platform/v2/x402/validate` checks
   a route before any payment.

## 4. Example agent code

### TypeScript (`@x402/fetch`)

```ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

const res = await fetchWithPayment("https://gblin.digital/api/x402/attestation");
const { attestation, signature, attestor } = await res.json();
console.log("regime:", attestation.regime, "signed by", attestor);
```

Free endpoints need no client at all:

```bash
curl -s https://gblin.digital/api/x402/treasury-state
```

### Paying from a treasury that holds GBLIN

[`@gblin-protocol/agent-treasury`](https://www.npmjs.com/package/@gblin-protocol/agent-treasury)
wraps the same client and refills USDC from GBLIN before signing when the wallet is short:

```bash
npx @gblin-protocol/agent-treasury pay https://gblin.digital/api/x402/attestation --max-amount 3000 --json
```

### MCP equivalent (free)

```bash
npx @gblin-protocol/mcp-server                              # stdio, 20 tools
# hosted, no install: https://mcp.gblin.digital/mcp (24 tools)
```

## 5. Operational notes

- NAV and basket reads are cached 30-60 seconds in-process; the free endpoints are also
  cached at the CDN for 20-60 seconds.
- `/jit` checks the vault's redemption cooldown on-chain (`block.timestamp`, length read from
  the Lens). It applies only after a mint the wallet made for itself; a mint through the Zap
  leaves none. During the cooldown the endpoint answers 409 with `cooldown.secondsRemaining`
  instead of calldata that would revert.
- Every `minOut` is computed from on-chain quotes plus a dynamic slippage buffer (2.5%
  normally, 4% while the Crash Shield is active). No endpoint returns a zero `minOut`.
- Steps that go through the Zap carry an explicit gas limit (1,100,000): the vault reserves
  gas for its capped transfers and an automatic estimate can fall short.
- Prices and descriptions are configured in `src/middleware.ts`. A change to a paid
  challenge must be followed by a recapture of `test/x402-golden/` and a regeneration of the
  edge worker's challenge module.

## 6. Files

```
src/
├── middleware.ts                      # x402 paywall: the three paid paths, prices, descriptions
├── lib/x402-helpers.ts                # NAV, basket, quotes, calldata, protocol limits
└── app/api/x402/
    ├── attestation/route.ts           # paid
    ├── seal/route.ts                  # paid
    ├── catalog/route.ts               # paid
    ├── attestation-sample/route.ts    # free: a signed sample, already expired, with the same schema
    ├── treasury-state/route.ts        # free
    ├── quote/route.ts                 # free
    ├── governance/route.ts            # free
    ├── health/route.ts                # free
    ├── invest/route.ts                # free
    ├── jit/route.ts                   # free
    └── llms.txt/route.ts              # discovery manifest
test/x402-golden/                      # byte-for-byte fixtures of the paid challenges
```
