import { simulateGblin, type Allocation } from "./crash-simulator";
import type { PricePoint } from "./crash-simulator";

/**
 * Hardcoded daily price snapshots for major crypto crashes.
 *
 * Prices are approximated from public market data (CoinGecko / Chainlink
 * historical). They are intentionally simplified to daily resolution to keep
 * the simulator fast and deterministic.
 *
 * The "cbBTC" series uses BTC spot price as a stand-in (cbBTC tracks BTC ~1:1).
 * The "weth" series uses ETH spot price.
 * USDC is held flat at $1.00 (the depeg in March 2023 is out of scope).
 */

export type CrashScenario = {
  id: "jan2026" | "nov2022" | "may2021" | "mar2020";
  label: string;
  shortLabel: string;
  duration: string;
  summary: string;
  trajectory: PricePoint[];
};

/** Base allocation GBLIN uses before any crash (protocol defaults) */
export const BASE_ALLOCATION: Allocation = { cbBTC: 0.45, weth: 0.45, usdc: 0.10 };

/**
 * Compute the correct GBLIN post-crash allocation for a given scenario.
 * This is what the user must guess to win the game.
 * Returns weights rounded to nearest integer percent.
 */
export function getCorrectAllocation(scenario: CrashScenario): { cbBTC: number; weth: number; usdc: number } {
  const result = simulateGblin(10_000, BASE_ALLOCATION, scenario.trajectory);
  const lastWeights = result.weights?.[result.weights.length - 1];
  if (!lastWeights) return { cbBTC: 45, weth: 45, usdc: 10 };
  const total = lastWeights.cbBTC + lastWeights.weth + lastWeights.usdc;
  return {
    cbBTC: Math.round((lastWeights.cbBTC / total) * 100),
    weth: Math.round((lastWeights.weth / total) * 100),
    usdc: Math.round((lastWeights.usdc / total) * 100),
  };
}

export const CRASH_SCENARIOS: Record<CrashScenario["id"], CrashScenario> = {
  jan2026: {
    id: "jan2026",
    label: "January 2026 — The Full Correction",
    shortLabel: "Jan 2026",
    duration: "18 days",
    summary:
      "BTC peaked at ~$108k in December 2025 then fell ~40% to ~$65k by end-January 2026. " +
      "ETH dropped ~43% from ~$3,900 to ~$2,200. A slow-motion deleveraging with two sharp legs down.",
    trajectory: [
      { day: 0,  cbBTC: 108_000, weth: 3_900, usdc: 1 },
      { day: 1,  cbBTC: 105_000, weth: 3_750, usdc: 1 },
      { day: 2,  cbBTC: 101_000, weth: 3_600, usdc: 1 },
      { day: 3,  cbBTC: 96_000,  weth: 3_400, usdc: 1 },
      { day: 4,  cbBTC: 90_000,  weth: 3_150, usdc: 1 },
      { day: 5,  cbBTC: 86_000,  weth: 3_000, usdc: 1 },
      { day: 6,  cbBTC: 84_000,  weth: 2_900, usdc: 1 },
      { day: 7,  cbBTC: 82_000,  weth: 2_800, usdc: 1 },
      { day: 8,  cbBTC: 79_000,  weth: 2_680, usdc: 1 },
      { day: 9,  cbBTC: 76_000,  weth: 2_560, usdc: 1 },
      { day: 10, cbBTC: 74_000,  weth: 2_480, usdc: 1 },
      { day: 11, cbBTC: 71_000,  weth: 2_380, usdc: 1 },
      { day: 12, cbBTC: 69_000,  weth: 2_300, usdc: 1 },
      { day: 13, cbBTC: 67_500,  weth: 2_240, usdc: 1 },
      { day: 14, cbBTC: 66_000,  weth: 2_210, usdc: 1 },
      { day: 15, cbBTC: 65_500,  weth: 2_200, usdc: 1 },
      { day: 16, cbBTC: 65_000,  weth: 2_200, usdc: 1 },
      { day: 17, cbBTC: 64_800,  weth: 2_195, usdc: 1 },
      { day: 18, cbBTC: 65_200,  weth: 2_210, usdc: 1 },
    ],
  },
  nov2022: {
    id: "nov2022",
    label: "November 2022 — FTX Collapse",
    shortLabel: "Nov 2022",
    duration: "7 days",
    summary:
      "FTX insolvency triggered a full sector contagion. " +
      "BTC fell ~26% from $21k to $15.5k and ETH ~32% from $1,580 to $1,070 in a week.",
    trajectory: [
      { day: 0, cbBTC: 21_000, weth: 1_580, usdc: 1 },
      { day: 1, cbBTC: 20_100, weth: 1_490, usdc: 1 },
      { day: 2, cbBTC: 18_400, weth: 1_310, usdc: 1 },
      { day: 3, cbBTC: 17_200, weth: 1_200, usdc: 1 },
      { day: 4, cbBTC: 16_500, weth: 1_140, usdc: 1 },
      { day: 5, cbBTC: 16_000, weth: 1_090, usdc: 1 },
      { day: 6, cbBTC: 15_800, weth: 1_070, usdc: 1 },
    ],
  },
  may2021: {
    id: "may2021",
    label: "May 2021 — The Leverage Flush",
    shortLabel: "May 2021",
    duration: "5 days",
    summary:
      "Cascading liquidations from over-leveraged perpetual positions. " +
      "BTC dropped from $58k to $30k (~48%) and ETH from $4.1k to $1.7k (~58%) in a week.",
    trajectory: [
      { day: 0, cbBTC: 58_000, weth: 4_100, usdc: 1 },
      { day: 1, cbBTC: 54_000, weth: 3_800, usdc: 1 },
      { day: 2, cbBTC: 42_000, weth: 3_100, usdc: 1 },
      { day: 3, cbBTC: 38_000, weth: 2_700, usdc: 1 },
      { day: 4, cbBTC: 35_000, weth: 2_400, usdc: 1 },
      { day: 5, cbBTC: 30_000, weth: 1_800, usdc: 1 },
    ],
  },
  mar2020: {
    id: "mar2020",
    label: "March 2020 — Black Thursday",
    shortLabel: "Mar 2020",
    duration: "3 days",
    summary:
      "COVID-19 macro crash. BTC halved in a single day from $8k to $4k, " +
      "ETH from $200 to $110, while traditional markets locked limit-down.",
    trajectory: [
      { day: 0, cbBTC: 8_000, weth: 200, usdc: 1 },
      { day: 1, cbBTC: 7_400, weth: 180, usdc: 1 },
      { day: 2, cbBTC: 4_500, weth: 115, usdc: 1 },
      { day: 3, cbBTC: 4_000, weth: 110, usdc: 1 },
    ],
  },
};

export const CRASH_LIST: CrashScenario[] = [
  CRASH_SCENARIOS.jan2026,
  CRASH_SCENARIOS.nov2022,
  CRASH_SCENARIOS.may2021,
  CRASH_SCENARIOS.mar2020,
];

export function getCrashById(id: string): CrashScenario | null {
  if (id === "jan2026" || id === "nov2022" || id === "may2021" || id === "mar2020") {
    return CRASH_SCENARIOS[id];
  }
  return null;
}
