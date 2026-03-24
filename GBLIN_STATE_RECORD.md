# GBLIN PROTOCOL - STATE RECORD & DEPLOYMENT REGISTRY

## CORE CONTRACT
- **Network:** Base Mainnet
- **Contract Name:** GBLINBaseFinal
- **Active Contract Address:** `0xc475851f9101A2AC48a84EcF869766A94D301FaA`
- **Status:** INITIALIZED, RENOUNCED & VERIFIED
- **Cooldown Parameter:** 2 minutes (Active)

## TEST LOGS - 15/03/2026

### TEST 1: INITIALIZATION & BUY (BASKET CREATION)
- **Block:** 43374112
- **Tx Hash:** `0x52c4ccfbd636861ed18756f7d70a62e83e30cb36a455b315dead00ab21e76f2d`
- **Input Value:** `958440000000000` wei (~$3)
- **Result:** SUCCESS. 
- **Mechanics Verified:** 
  - 0.1% Fee extraction (`958440000000` wei).
  - Anti-inflation burn (1000 wei to `0x000...000`).
  - 45% cbBTC swap execution (`1266` satoshi).
  - 10% USDC swap execution (`199809` micro-USDC).
  - 45% WETH reserve retention.

### TEST 2: PRO-RATA REDEMPTION & SELL
- **Block:** 43374227
- **Tx Hash:** `0xf10403285cd8a29aff305b61296cef48dc1a04e607c319895d3d85434a69cc70`
- **Input:** `957481559999000` GBLIN (Burned)
- **Result:** SUCCESS.
- **Mechanics Verified:**
  - 2-minute Cooldown enforcement.
  - Exact pro-rata liquidation of cbBTC and USDC via Uniswap V3.
  - Unwrapping of WETH and return of native ETH to user (`956710938314422` wei).
  - Total slippage/fee impact: ~0.18% (Mathematically acceptable).

## PROTOCOL ARCHITECT NOTES
The contract operates with mathematical precision. The basket logic and the anti-bank-run mechanisms are fully functional. Ready for scaling tests.
