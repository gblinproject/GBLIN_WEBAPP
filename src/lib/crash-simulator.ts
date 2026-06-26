/**
 * Crash Shield Simulator — TypeScript port of GBLIN_V6.refreshWeights().
 *
 * Mirrors the on-chain V6 logic (production tuning setShieldCurve(15, 3000)):
 *   - EWMA volatility per asset:   inst*3 + prev*7 over 10  (3/7 smoothing)
 *   - Dual peak ratchet with decay: fast 50 bps/day, slow 15 bps/day
 *   - Adaptive crash threshold:    base 1500 bps + ewmaVol * 5000/10000,
 *                                  clamped to [1500, 5000] bps
 *   - Hysteresis:                  shield ON when drawdown > threshold,
 *                                  OFF again only when drawdown < 800 bps
 *   - Proportional slash:          severity 0..1 between threshold and the
 *                                  full-slash drawdown (3000 bps); at full
 *                                  severity the asset keeps slashMultiplier
 *                                  (2000 bps = 20%) of its base weight
 *   - Slashed weight is redistributed to the stable asset (USDC).
 *
 * Two parallel paths:
 *  1) "direct" — passive hold of the initial allocation, no rebalance.
 *  2) "gblin"  — daily refreshWeights + rebalance to dynamicWeight.
 *
 * Idealised path: zero swap fees / slippage / keeper lag, daily resolution.
 * Real protocol performance is slightly worse — the UI shows this caveat.
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
  /** USDC pegged to 1 USD */
  usdc: number;
};

export type SimulationResult = {
  /** Final portfolio value in USD */
  finalValue: number;
  /** Final return vs initial USD value, fractional (e.g. -0.28 = -28%) */
  drawdownPct: number;
  /** Worst peak-to-trough drawdown over the window, fractional (negative) */
  maxDrawdownPct: number;
  /** Per-day USD value trajectory */
  trajectory: number[];
  /** Per-day breakdown of dynamic weights (only meaningful for "gblin" mode) */
  weights?: Array<{ day: number; cbBTC: number; weth: number; usdc: number }>;
};

// ---- V6 production constants (bps unless noted) ----
const BPS = 10_000;
const BASE_CRASH_THRESHOLD_BPS = 1500;
const CRASH_VOL_MULTIPLIER = 5000;
const MIN_CRASH_BPS = 1500;
const MAX_CRASH_BPS = 5000;
const RECOVERY_BAND_BPS = 800;
const SLASH_MULTIPLIER_BPS = 2000;       // weight kept at full slash (20%)
const FULL_SLASH_DRAWDOWN_BPS = 3000;    // drawdown at which severity = 1
const PEAK_DECAY_PER_DAY_BPS = 50;       // fast peak
const SLOW_PEAK_DECAY_PER_DAY_BPS = 15;  // slow peak (setShieldCurve 15)

type RiskState = {
  base: number;
  dyn: number;
  peak: number;
  slow: number;
  ewmaVolBps: number;
  lastObs: number;
  shielded: boolean;
};

function maxDrawdown(path: number[]): number {
  let peak = path[0] ?? 0;
  let mdd = 0;
  for (const v of path) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (peak - v) / peak;
      if (dd > mdd) mdd = dd;
    }
  }
  return -mdd;
}

/**
 * Passive "direct" hold of the initial allocation. No rebalancing.
 */
export function simulateDirect(
  initialUsd: number,
  allocation: Allocation,
  trajectory: PricePoint[],
): SimulationResult {
  if (trajectory.length === 0) {
    return { finalValue: initialUsd, drawdownPct: 0, maxDrawdownPct: 0, trajectory: [initialUsd] };
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
    maxDrawdownPct: maxDrawdown(path),
    trajectory: path,
  };
}

/**
 * V6 refreshWeights for one daily observation. Mutates `risk` state in place
 * and returns the normalised dynamic weights (fractions summing to ~1).
 */
function refreshWeights(
  risk: { cbBTC: RiskState; weth: RiskState },
  stableBase: number,
  prices: { cbBTC: number; weth: number },
): Allocation {
  let totalSlashed = 0;

  (["cbBTC", "weth"] as const).forEach((k) => {
    const a = risk[k];
    a.dyn = a.base;
    const cp = prices[k];

    if (a.lastObs > 0) {
      const inst = (Math.abs(cp - a.lastObs) / a.lastObs) * BPS;
      a.ewmaVolBps = (inst * 3 + a.ewmaVolBps * 7) / 10;
    }
    a.lastObs = cp;

    // fast peak
    if (a.peak > 0) {
      const dec = (a.peak * PEAK_DECAY_PER_DAY_BPS) / BPS;
      a.peak = dec < a.peak ? a.peak - dec : cp;
    }
    if (cp > a.peak) a.peak = cp;

    // slow peak
    if (a.slow > 0) {
      const sdec = (a.slow * SLOW_PEAK_DECAY_PER_DAY_BPS) / BPS;
      a.slow = sdec < a.slow ? a.slow - sdec : cp;
    }
    if (cp > a.slow) a.slow = cp;

    const ddF = a.peak > cp ? ((a.peak - cp) / a.peak) * BPS : 0;
    const ddS = a.slow > cp ? ((a.slow - cp) / a.slow) * BPS : 0;
    const drawdown = Math.max(ddF, ddS);

    let eff = BASE_CRASH_THRESHOLD_BPS + (a.ewmaVolBps * CRASH_VOL_MULTIPLIER) / BPS;
    eff = Math.max(MIN_CRASH_BPS, Math.min(MAX_CRASH_BPS, eff));

    if (!a.shielded && drawdown > eff) a.shielded = true;
    else if (a.shielded && drawdown < RECOVERY_BAND_BPS) a.shielded = false;

    if (a.shielded) {
      let sev: number;
      if (drawdown >= FULL_SLASH_DRAWDOWN_BPS) sev = 1;
      else if (drawdown > eff && FULL_SLASH_DRAWDOWN_BPS > eff)
        sev = (drawdown - eff) / (FULL_SLASH_DRAWDOWN_BPS - eff);
      else sev = 0;

      const keepBps = BPS - sev * (BPS - SLASH_MULTIPLIER_BPS);
      const next = (a.base * keepBps) / BPS;
      totalSlashed += a.base - next;
      a.dyn = next;
    }
  });

  let usdcDyn = stableBase;
  if (totalSlashed > 0) usdcDyn += totalSlashed;

  const total = risk.cbBTC.dyn + risk.weth.dyn + usdcDyn || 1;
  return {
    cbBTC: risk.cbBTC.dyn / total,
    weth: risk.weth.dyn / total,
    usdc: usdcDyn / total,
  };
}

/**
 * Simulate the GBLIN basket with the V6 Crash Shield enabled.
 * The user-supplied `allocation` is treated as the protocol `baseWeight`.
 */
export function simulateGblin(
  initialUsd: number,
  allocation: Allocation,
  trajectory: PricePoint[],
): SimulationResult {
  if (trajectory.length === 0) {
    return { finalValue: initialUsd, drawdownPct: 0, maxDrawdownPct: 0, trajectory: [initialUsd] };
  }

  const first = trajectory[0];
  let holdings = {
    cbBTC: first.cbBTC > 0 ? (initialUsd * allocation.cbBTC) / first.cbBTC : 0,
    weth: first.weth > 0 ? (initialUsd * allocation.weth) / first.weth : 0,
    usdc: initialUsd * allocation.usdc,
  };

  const mk = (base: number): RiskState => ({
    base, dyn: base, peak: 0, slow: 0, ewmaVolBps: 0, lastObs: 0, shielded: false,
  });
  const risk = { cbBTC: mk(allocation.cbBTC), weth: mk(allocation.weth) };

  const path: number[] = [];
  const weightsLog: NonNullable<SimulationResult["weights"]> = [];

  for (let i = 0; i < trajectory.length; i++) {
    const p = trajectory[i];

    const dw = refreshWeights(risk, allocation.usdc, { cbBTC: p.cbBTC, weth: p.weth });

    const usdValue = holdings.cbBTC * p.cbBTC + holdings.weth * p.weth + holdings.usdc;

    if (usdValue > 0) {
      holdings = {
        cbBTC: p.cbBTC > 0 ? (usdValue * dw.cbBTC) / p.cbBTC : 0,
        weth: p.weth > 0 ? (usdValue * dw.weth) / p.weth : 0,
        usdc: usdValue * dw.usdc,
      };
    }

    path.push(usdValue);
    weightsLog.push({ day: p.day, cbBTC: dw.cbBTC, weth: dw.weth, usdc: dw.usdc });
  }

  const finalValue = path[path.length - 1];

  return {
    finalValue,
    drawdownPct: (finalValue - initialUsd) / initialUsd,
    maxDrawdownPct: maxDrawdown(path),
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
