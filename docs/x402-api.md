# GBLIN x402 API

Paid HTTP endpoints that expose the GBLIN protocol to autonomous agents.
Every endpoint requires a micropayment in USDC on Base mainnet, settled
on-chain via the [x402](https://x402.org) protocol.

These endpoints are the HTTP / paid mirror of the free
[`@gblin-protocol/mcp-server`](https://www.npmjs.com/package/@gblin-protocol/mcp-server)
MCP server. Same logic, different distribution channel:

|                  | MCP server (free)            | x402 API (paid)                    |
| ---------------- | ---------------------------- | ---------------------------------- |
| Transport        | stdio (local process)        | HTTPS                              |
| Target           | Developers building agents   | Live agents paying per call        |
| Discovery        | MCP Registry                 | agentic.market, x402scan, Bazaar   |
| Code path        | `GBLIN-MCP/src/tools.ts`     | `GBLIN_WEBAPP/src/app/api/x402/*`  |

## 1. Endpoints

Public discovery manifest (free, no paywall):

```
GET https://gblin.digital/api/x402/llms.txt
```

Paid endpoints (each returns HTTP 402 + payment requirements on first call,
then the JSON response on the second call with the `X-PAYMENT` header set):

| Endpoint                        | Price       | Description                                                                 |
| ------------------------------- | ----------- | --------------------------------------------------------------------------- |
| `GET /api/x402/treasury-state`  | $0.001 USDC | NAV + basket weights + Crash Shield status                                  |
| `GET /api/x402/quote`           | $0.001 USDC | Preview a buy or sell (no execution) with dynamic slippage                  |
| `GET /api/x402/jit`             | $0.005 USDC | JIT GBLIN→USDC calldata (`sellGBLINForToken`)                               |
| `GET /api/x402/invest`          | $0.002 USDC | USDC→GBLIN treasury accumulation (approve + `buyGBLINWithToken`)            |
| `GET /api/x402/health`          | $0.002 USDC | Wallet balances + gas runway + rebalance recommendation                     |
| `GET /api/x402/governance`      | $0.001 USDC | Verify the 48h Timelock owns the contract + read its min delay              |

USDC payments flow directly to the wallet defined by `X402_PAY_TO_WALLET`.
The server never holds funds.

## 2. How payments work

```
Agent (wallet) ──HTTP GET──▶ api.gblin.digital
                              │
                              ├─ 1st call: returns 402 + payment requirements
                              │
                              ◀─ X-PAYMENT header (signed EIP-3009 auth) ─┐
                                                                          │
Agent retries with X-PAYMENT ──HTTP GET──▶ api.gblin.digital              │
                                              │                            │
                                              ├─ middleware calls          │
                                              │  Coinbase CDP facilitator  │
                                              │  to verify + settle on Base│
                                              │                            │
                                              ◀── JSON response + ─────────┘
                                                 X-PAYMENT-RESPONSE
                                                 (settlement tx hash)
```

Payments are atomic: the route handler runs **after** the facilitator
confirms the USDC transfer. If verification fails, the response is still
402 and no work is done.

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

Once deployed and the `/api/x402/llms.txt` endpoint returns 200:

1. **agentic.market** — go to [agentic.market/validate](https://agentic.market/validate),
   paste `https://gblin.digital/api/x402/treasury-state`, click **Validate**.
2. **x402scan.com** — go to [x402scan.com/resources/register](https://x402scan.com/resources/register),
   paste the same URL, click **Add**.
3. **x402 Bazaar** — automatic. The Coinbase facilitator indexes your routes
   after the first settled payment.

## 4. Example agent code

### TypeScript (Coinbase x402-fetch)

```ts
import { wrapFetchWithPayment } from "x402-fetch";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({ account, chain: base, transport: http() });
const fetchWithPayment = wrapFetchWithPayment(fetch, wallet);

const res = await fetchWithPayment(
  "https://gblin.digital/api/x402/treasury-state"
);
const state = await res.json();
console.log("NAV:", state.nav_usd, "Crash Shield:", state.crash_shield_active);
```

### Python (x402-python)

```python
from x402 import x402_requests
import os

session = x402_requests.Session(private_key=os.environ["AGENT_PRIVATE_KEY"])
state = session.get("https://gblin.digital/api/x402/treasury-state").json()
print(f"NAV: ${state['nav_usd']}, Crash Shield: {state['crash_shield_active']}")
```

### MCP equivalent (free, local)

```bash
npx @gblin-protocol/mcp-server   # exposes the same 6 tools over stdio
```

## 5. Operational notes

- All responses are cached (NAV/basket: 30–60s in-process). Repeated agent
  polling within the same Vercel invocation pays again but reads cache.
- The `/jit` endpoint enforces the contract's 2-minute cooldown via an
  on-chain `block.timestamp` read — agents that recently called `buyGBLIN`
  get a 409 with `seconds_remaining` instead of bad calldata.
- All `minOut` values are computed from on-chain quotes plus a dynamic
  slippage buffer (2.5% normal, 4% during Crash Shield). No endpoint ever
  returns a 0 minOut.
- The middleware is in `src/middleware.ts`. Pricing is configurable there.

## 6. Files

```
src/
├── middleware.ts                      # x402 paywall, route + price config
├── lib/x402-helpers.ts                # NAV, basket, JIT quote, calldata
└── app/api/x402/
    ├── treasury-state/route.ts
    ├── quote/route.ts
    ├── jit/route.ts
    ├── invest/route.ts
    ├── health/route.ts
    ├── governance/route.ts
    └── llms.txt/route.ts              # public discovery manifest (no paywall)
```
