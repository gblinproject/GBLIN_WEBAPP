<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

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

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app: `npm run dev`

View the app in AI Studio: https://ai.studio/apps/dceff8c2-051b-45f0-b65e-73e904fcb211
