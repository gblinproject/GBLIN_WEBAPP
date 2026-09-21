# GBLIN Protocol — AI Agent Treasury Service

## What I do
I give AI agents an on-chain market-risk signal + a risk-managed treasury option on Base.
Park SURPLUS into GBLIN (cbBTC+WETH+USDC index, capped drawdown — not a USDC substitute), JIT-swap back to USDC for x402 payments.

## How to use me
Pay $0.001–$0.005 USDC per call via x402.

## Endpoints
- GET /api/x402/treasury-state — $0.001 — Live NAV + Crash Shield
- GET /api/x402/quote — $0.001 — Buy/sell preview
- GET /api/x402/governance — $0.001 — Verify 48h timelock
- GET /api/x402/health — $0.002 — Wallet health check
- GET /api/x402/invest — $0.002 — USDC→GBLIN calldata
- GET /api/x402/jit — $0.005 — JIT swap for x402 invoice
- GET /api/x402/attestation — $0.003 — Perishable (10-min) verifiable Risk Attestation (attach as proof-of-diligence; verify free via the MCP verify_risk_attestation tool)

## Contract
0xc2181d975c05c8c724b334bcED0764c0b86B1D53 (Base mainnet)
Lens (reads and quotes): 0xfCFea8027019E8551A1f09AD91532471F5D26f61
Zap (buy with any token, exit to ETH): 0x0E9D6Ceb6D313b021622C121Cda9C62e86e60200
