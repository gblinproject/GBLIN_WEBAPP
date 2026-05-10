/**
 * Crash Shield Simulator — TypeScript port of GBLIN_V5.refreshWeights().
 *
 * Mirrors the on-chain logic from contracts/GBLIN_V5.sol:
 *   - CRASH_THRESHOLD_BPS = 2000  (20% drawdown triggers slash)
 *   - SLASH_MULTIPLIER    = 2000  (asset retains 20% of baseWeight when slashed)
 *   - PEAK_DECAY_PER_DAY  = 50    (0.5% peakPrice decay per day)
 *   - Slashed weight is redistributed to stable assets (USDC).
 *
 * The simulator runs two parallel paths:
 *  1) "direct"  — passive hold of the initial allocation, no rebalance.
 *  2) "gblin"   — daily refreshWeights + instant rebalance to dynamicWeight.
 *
 * Note: the GBLIN simulation assumes zero swap fees / slippage / keeper lag.
 * Real protocol performance is slightly worse than this idealised path.
 * Conservative caveat is shown in the UI.
 */

export type Allocation = {
  cbBTC: number; // 0..1, fraction of total
  weth: number;  // 0..1
  usdc: number;  // 0..1
};

export type PricePoint = {
  /** Day index from start of crash window */
  day: number;
  /** cbBTC / BTC price in USD */
  cbBTC: number;
  /** WETH / ETH price in USD */
  weth: number;
  /** USDC pegged to 1 USD (kept for symmetry / future use) */
  usdc: number;
};

export type SimulationResult = {
  /** Final portfolio value in USD */
  finalValue: number;
  /** Drawdown vs initial USD value, fractional (e.g. -0.28 = -28%) */
  drawdownPct: number;
  /** Per-day USD value trajectory */
  trajectory: number[];
  /** Per-day breakdown of weights (only meaningful for "gblin" mode) */
  weights?: Array<{ day: number; cbBTC: number; weth: number; usdc: number }>;
};

const CRASH_THRESHOLD = 0.20;       // 20% drawdown
const SLASH_RETENTION = 0.20;       // asset keeps 20% of base weight after slash
const PEAK_DECAY_PER_DAY = 0.005;   // 0.5%/day

/**
 * Simulate a passive "direct" hold of the initial allocation through the crash window.
 * No rebalancing. Holdings are fixed at t=0; final value = holdings × final prices.
 */
export function simulateDirect(
  initialUsd: number,
  allocation: Allocation,
  trajectory: PricePoint[],
): SimulationResult {
  if (trajectory.length === 0) {
    return { finalValue: initialUsd, drawdownPct: 0, trajectory: [initialUsd] };
  }

  const first = trajectory[0];
  const holdings = {
    cbBTC: first.cbBTC > 0 ? (initialUsd * allocation.cbBTC) / first.cbBTC : 0,
    weth: first.weth > 0 ? (initialUsd * allocation.weth) / first.weth : 0,
    usdc: initialUsd * allocation.usdc,
  };

  const path = trajectory.map((p) =>
    holdings.cbBTC * p.cbBTC + holdings.weth * p.weth + holdings.usdc,
  );
  const finalValue = path[path.length - 1];

  return {
    finalValue,
    drawdownPct: (finalValue - initialUsd) / initialUsd,
    trajectory: path,
  };
}

/**
 * Simulate the GBLIN basket with Crash Shield enabled.
 *
 * Each day: refreshWeights() is computed, then the portfolio is instantly
 * rebalanced to the new dynamicWeight target (no fees / slippage in sim).
 *
 * The user-supplied `allocation` is treated as the protocol's `baseWeight`
 * (the immutable target). `dynamicWeight` is what shifts during slashes.
 */
export function simulateGblin(
  initialUsd: number,
  allocation: Allocation,
  trajectory: PricePoint[],
): SimulationResult {
  if (trajectory.length === 0) {
    return { finalValue: initialUsd, drawdownPct: 0, trajectory: [initialUsd] };
  }

  const first = trajectory[0];
  let holdings = {
    cbBTC: first.cbBTC > 0 ? (initialUsd * allocation.cbBTC) / first.cbBTC : 0,
    weth: first.weth > 0 ? (initialUsd * allocation.weth) / first.weth : 0,
    usdc: initialUsd * allocation.usdc,
  };

  const peakPrices = {
    cbBTC: first.cbBTC,
    weth: first.weth,
  };

  const path: number[] = [];
  const weightsLog: NonNullable<SimulationResult["weights"]> = [];

  for (const p of trajectory) {
    // 1) Update peak prices: ratchet up, decay slowly downward.
    peakPrices.cbBTC = Math.max(peakPrices.cbBTC * (1 - PEAK_DECAY_PER_DAY), p.cbBTC);
    peakPrices.weth = Math.max(peakPrices.weth * (1 - PEAK_DECAY_PER_DAY), p.weth);

    // 2) Compute drawdowns from current peak.
    const ddBTC = peakPrices.cbBTC > 0
      ? (peakPrices.cbBTC - p.cbBTC) / peakPrices.cbBTC
      : 0;
    const ddETH = peakPrices.weth > 0
      ? (peakPrices.weth - p.weth) / peakPrices.weth
      : 0;

    // 3) Compute dynamicWeights (refreshWeights logic).
    const dw = { cbBTC: allocation.cbBTC, weth: allocation.weth, usdc: allocation.usdc };
    let slashed = 0;

    if (ddBTC > CRASH_THRESHOLD) {
      const newWeight = allocation.cbBTC * SLASH_RETENTION;
      slashed += allocation.cbBTC - newWeight;
      dw.cbBTC = newWeight;
    }
    if (ddETH > CRASH_THRESHOLD) {
      const newWeight = allocation.weth * SLASH_RETENTION;
      slashed += allocation.weth - newWeight;
      dw.weth = newWeight;
    }
    dw.usdc += slashed;

    // 4) Compute current portfolio USD value at today's prices.
    const usdValue =
      holdings.cbBTC * p.cbBTC + holdings.weth * p.weth + holdings.usdc;

    // 5) Rebalance to dynamic weights (instant, lossless in sim).
    const totalWeight = dw.cbBTC + dw.weth + dw.usdc;
    if (totalWeight > 0 && usdValue > 0) {
      holdings = {
        cbBTC: p.cbBTC > 0 ? (usdValue * dw.cbBTC / totalWeight) / p.cbBTC : 0,
        weth: p.weth > 0 ? (usdValue * dw.weth / totalWeight) / p.weth : 0,
        usdc: (usdValue * dw.usdc) / totalWeight,
      };
    }

    path.push(usdValue);
    weightsLog.push({ day: p.day, ...dw });
  }

  const finalValue = path[path.length - 1];

  return {
    finalValue,
    drawdownPct: (finalValue - initialUsd) / initialUsd,
    trajectory: path,
    weights: weightsLog,
  };
}

/**
 * Validate and normalise a user-provided allocation so the components sum to 1.
 * Returns null if any component is negative or the sum is zero.
 */
export function normaliseAllocation(input: Allocation): Allocation | null {
  if (input.cbBTC < 0 || input.weth < 0 || input.usdc < 0) return null;
  const total = input.cbBTC + input.weth + input.usdc;
  if (total <= 0) return null;
  return {
    cbBTC: input.cbBTC / total,
    weth: input.weth / total,
    usdc: input.usdc / total,
  };
}
