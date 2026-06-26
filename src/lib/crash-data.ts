/**
 * Real crash drawdowns — single source of truth.
 *
 * Peak-to-trough drawdowns from the 10-year on-chain GBLIN Crash-Shield backtest
 * (production tuning: slow peak decay 15 bps/day, full-slash drawdown 30%).
 * Used by the /frame hook, the /game challenge and the /portfolio wallet tool so
 * every surface shows the same verified numbers.
 */

export type CrashData = {
  id: string;
  label: string;
  short: string;
  when: string;
  /** GBLIN basket drawdown, % positive magnitude */
  gblin: number;
  /** 100% BTC drawdown, % */
  btc: number;
  /** 100% ETH drawdown, % */
  eth: number;
};

export const CRASHES: CrashData[] = [
  { id: "ftx", label: "FTX collapse", short: "the FTX collapse", when: "Nov 2022", gblin: 5.7, btc: 26.0, eth: 33.1 },
  { id: "covid", label: "COVID crash", short: "the COVID crash", when: "Feb–Apr 2020", gblin: 28.4, btc: 53.2, eth: 61.5 },
  { id: "may2021", label: "May 2021 flush", short: "the May 2021 flush", when: "Apr–Jul 2021", gblin: 31.7, btc: 53.1, eth: 57.3 },
  { id: "bear2022", label: "LUNA + 2022 bear", short: "the 2022 bear", when: "Apr–Dec 2022", gblin: 30.5, btc: 66.2, eth: 71.8 },
  { id: "bear2018", label: "Bear market 2018", short: "the 2018 bear", when: "Jan–Dec 2018", gblin: 41.4, btc: 81.4, eth: 94.0 },
];

export function getCrash(id: string): CrashData | undefined {
  return CRASHES.find((c) => c.id === id);
}

export type ValueWeights = {
  /** BTC + cbBTC share of portfolio value, 0..1 */
  btc: number;
  /** ETH + WETH share, 0..1 */
  eth: number;
  /** USDC / stables share, 0..1 (treated as flat in a crash) */
  usdc: number;
};

/**
 * Drawdown a user's portfolio (by value weights) would have suffered in a given
 * crash, vs the GBLIN basket in the same crash. Stables contribute 0 drawdown.
 * Returns positive magnitudes in %.
 */
export function portfolioVsGblin(weights: ValueWeights, crash: CrashData): {
  portfolio: number;
  gblin: number;
} {
  const portfolio = weights.btc * crash.btc + weights.eth * crash.eth;
  return { portfolio: Math.round(portfolio * 10) / 10, gblin: crash.gblin };
}

/** Worst-case crash for a given portfolio: the one where the user falls the most. */
export function worstCrash(weights: ValueWeights): {
  crash: CrashData;
  portfolio: number;
  gblin: number;
} {
  let worst = CRASHES[0];
  let worstDd = -1;
  for (const c of CRASHES) {
    const dd = weights.btc * c.btc + weights.eth * c.eth;
    if (dd > worstDd) {
      worstDd = dd;
      worst = c;
    }
  }
  const r = portfolioVsGblin(weights, worst);
  return { crash: worst, portfolio: r.portfolio, gblin: r.gblin };
}
