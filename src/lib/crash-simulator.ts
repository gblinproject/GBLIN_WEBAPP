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
 * Intraday rebalance model: within each day the simulator interpolates the
 * exact price at which the 20% drawdown threshold is first crossed and fires
 * the rebalance at that moment — not at end-of-day. This mirrors the real
 * protocol where any keeper can call refreshWeights() multiple times per day
 * the moment the threshold is breached.
 *
 * The user-supplied `allocation` is treated as the protocol's `baseWeight`.
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

  // Track whether each asset has already been slashed (persists across days)
  const slashState = { cbBTC: false, weth: false };

  const path: number[] = [];
  const weightsLog: NonNullable<SimulationResult["weights"]> = [];

  for (let i = 0; i < trajectory.length; i++) {
    const prev = i > 0 ? trajectory[i - 1] : trajectory[0];
    const p = trajectory[i];

    // 1) Update peak prices (ratchet up, decay slowly downward).
    peakPrices.cbBTC = Math.max(peakPrices.cbBTC * (1 - PEAK_DECAY_PER_DAY), p.cbBTC);
    peakPrices.weth  = Math.max(peakPrices.weth  * (1 - PEAK_DECAY_PER_DAY), p.weth);

    // 2) Intraday check: for each asset not yet slashed, find if/when the
    //    threshold is crossed during this day and rebalance at that price.
    const triggerBTC = peakPrices.cbBTC * (1 - CRASH_THRESHOLD);
    const triggerETH = peakPrices.weth  * (1 - CRASH_THRESHOLD);

    const btcTriggersToday = !slashState.cbBTC && prev.cbBTC > triggerBTC && p.cbBTC <= triggerBTC;
    const ethTriggersToday = !slashState.weth  && prev.weth  > triggerETH && p.weth  <= triggerETH;

    if (btcTriggersToday || ethTriggersToday) {
      // Interpolate the intraday fraction at which the first trigger fires.
      let tBTC = btcTriggersToday && prev.cbBTC !== p.cbBTC
        ? (prev.cbBTC - triggerBTC) / (prev.cbBTC - p.cbBTC)
        : Infinity;
      let tETH = ethTriggersToday && prev.weth !== p.weth
        ? (prev.weth - triggerETH) / (prev.weth - p.weth)
        : Infinity;

      // Fire rebalances in the order they would occur intraday.
      const events: Array<{ asset: "cbBTC" | "weth"; t: number }> = [];
      if (btcTriggersToday) events.push({ asset: "cbBTC", t: tBTC });
      if (ethTriggersToday) events.push({ asset: "weth",  t: tETH });
      events.sort((a, b) => a.t - b.t);

      for (const ev of events) {
        // Price at trigger moment (linear interpolation).
        const trigP = {
          cbBTC: prev.cbBTC + (p.cbBTC - prev.cbBTC) * ev.t,
          weth:  prev.weth  + (p.weth  - prev.weth)  * ev.t,
        };

        // Mark slashed.
        slashState[ev.asset] = true;

        // Compute current dynamic weights.
        const dw = {
          cbBTC: slashState.cbBTC ? allocation.cbBTC * SLASH_RETENTION : allocation.cbBTC,
          weth:  slashState.weth  ? allocation.weth  * SLASH_RETENTION : allocation.weth,
          usdc:  allocation.usdc,
        };
        const slashed =
          (slashState.cbBTC ? allocation.cbBTC * (1 - SLASH_RETENTION) : 0) +
          (slashState.weth  ? allocation.weth  * (1 - SLASH_RETENTION) : 0);
        dw.usdc += slashed;

        // Rebalance at trigger price.
        const usdAtTrigger =
          holdings.cbBTC * trigP.cbBTC + holdings.weth * trigP.weth + holdings.usdc;
        const tw = dw.cbBTC + dw.weth + dw.usdc;
        if (tw > 0 && usdAtTrigger > 0) {
          holdings = {
            cbBTC: trigP.cbBTC > 0 ? (usdAtTrigger * dw.cbBTC / tw) / trigP.cbBTC : 0,
            weth:  trigP.weth  > 0 ? (usdAtTrigger * dw.weth  / tw) / trigP.weth  : 0,
            usdc:  (usdAtTrigger * dw.usdc) / tw,
          };
        }
      }
    }

    // 3) Compute end-of-day dynamic weights (for assets already slashed).
    const dw = {
      cbBTC: slashState.cbBTC ? allocation.cbBTC * SLASH_RETENTION : allocation.cbBTC,
      weth:  slashState.weth  ? allocation.weth  * SLASH_RETENTION : allocation.weth,
      usdc:  allocation.usdc,
    };
    const slashedTotal =
      (slashState.cbBTC ? allocation.cbBTC * (1 - SLASH_RETENTION) : 0) +
      (slashState.weth  ? allocation.weth  * (1 - SLASH_RETENTION) : 0);
    dw.usdc += slashedTotal;

    // 4) End-of-day portfolio value.
    const usdValue = holdings.cbBTC * p.cbBTC + holdings.weth * p.weth + holdings.usdc;

    // 5) Daily rebalance to dynamic weights (keeper can always call this).
    const totalWeight = dw.cbBTC + dw.weth + dw.usdc;
    if (totalWeight > 0 && usdValue > 0) {
      holdings = {
        cbBTC: p.cbBTC > 0 ? (usdValue * dw.cbBTC / totalWeight) / p.cbBTC : 0,
        weth:  p.weth  > 0 ? (usdValue * dw.weth  / totalWeight) / p.weth  : 0,
        usdc:  (usdValue * dw.usdc) / totalWeight,
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
