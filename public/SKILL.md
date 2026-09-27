# GBLIN Protocol — AI Agent Treasury Service

## What I do
I give AI agents an on-chain market-risk signal + a risk-managed treasury option on Base.
Park SURPLUS into GBLIN (cbBTC+WETH+USDC index, capped drawdown — not a USDC substitute), JIT-swap back to USDC for x402 payments.

## How to use me
Vault-state routes are free. Three routes are paid via x402 ($0.003–$0.005 USDC per call).

## Endpoints
- GET /api/x402/treasury-state — free — Live NAV + Crash Shield
- GET /api/x402/quote — free — Buy/sell preview
- GET /api/x402/governance — free — Verify 48h timelock
- GET /api/x402/health — free — Wallet health check
- GET /api/x402/invest — free — USDC→GBLIN calldata
- GET /api/x402/jit — free — JIT swap for x402 invoice
- GET /api/x402/attestation — $0.003 — Perishable (10-min) verifiable Risk Attestation (attach as proof-of-diligence; verify free via the MCP verify_risk_attestation tool)

## Contract
0xc2181d975c05c8c724b334bcED0764c0b86B1D53 (Base mainnet)
Lens (reads and quotes): 0xfCFea8027019E8551A1f09AD91532471F5D26f61
Zap (buy with any token, exit to ETH): 0x0E9D6Ceb6D313b021622C121Cda9C62e86e60200
