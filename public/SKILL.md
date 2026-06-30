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

## Contract
0x36C81d7E1966310F305eA637e761Cf77F90852f0 (Base mainnet)
