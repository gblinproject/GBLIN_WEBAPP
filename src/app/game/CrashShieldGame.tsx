"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  normaliseAllocation,
  simulateDirect,
  simulateGblin,
  type Allocation,
} from "@/lib/crash-simulator";
import { CRASH_LIST, getCrashById, type CrashScenario } from "@/lib/historical-crashes";

const SITE_URL = "https://gblin.digital";
const STARTING_USD = 10_000;
const DEFAULT_ALLOCATION: Allocation = { cbBTC: 0.45, weth: 0.45, usdc: 0.10 };

const fmtUsd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const fmtPct = (n: number, digits = 1) =>
  `${(n * 100).toFixed(digits)}%`;

type Step = "setup" | "result";

export default function CrashShieldGame() {
  const [step, setStep] = useState<Step>("setup");
  const [crash, setCrash] = useState<CrashScenario>(CRASH_LIST[0]);
  // Allocation tracked as percentage points (0-100) for slider UX, normalised before sim.
  const [pctBTC, setPctBTC] = useState(45);
  const [pctETH, setPctETH] = useState(45);
  const [pctUSDC, setPctUSDC] = useState(10);

  // If user lands on /game?crash=jan2026&saved=... auto-show that result.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const c = params.get("crash");
    if (c) {
      const found = getCrashById(c);
      if (found) {
        setCrash(found);
        setStep("result");
      }
    }
  }, []);

  const total = pctBTC + pctETH + pctUSDC;
  const isAllocationValid = total === 100;

  const result = useMemo(() => {
    const raw: Allocation = {
      cbBTC: pctBTC / 100,
      weth: pctETH / 100,
      usdc: pctUSDC / 100,
    };
    const allocation = normaliseAllocation(raw) ?? DEFAULT_ALLOCATION;
    const direct = simulateDirect(STARTING_USD, allocation, crash.trajectory);
    const gblin = simulateGblin(STARTING_USD, allocation, crash.trajectory);
    const saved = gblin.finalValue - direct.finalValue;
    return { allocation, direct, gblin, saved };
  }, [pctBTC, pctETH, pctUSDC, crash]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at top, #1a1408 0%, #050505 60%)",
        color: "#f5d77a",
        padding: "24px 16px 80px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <header style={{ maxWidth: 720, margin: "0 auto 24px" }}>
        <Link
          href="/"
          style={{
            color: "#9a8a5c",
            fontSize: 13,
            letterSpacing: 1,
            textDecoration: "none",
          }}
        >
          ← back to gblin.digital
        </Link>
        <h1 style={{ fontSize: 36, margin: "12px 0 4px", letterSpacing: -1 }}>
          Survive the Crash
        </h1>
        <p style={{ color: "#9a8a5c", margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          A backtest of GBLIN&apos;s autonomous Crash Shield against real crypto
          crashes. Allocate ${fmtUsd(STARTING_USD, 0)}, pick a crash, see how
          much the basket would have saved you.
        </p>
      </header>

      {step === "setup" && (
        <SetupCard
          crash={crash}
          setCrash={setCrash}
          pctBTC={pctBTC}
          setPctBTC={setPctBTC}
          pctETH={pctETH}
          setPctETH={setPctETH}
          pctUSDC={pctUSDC}
          setPctUSDC={setPctUSDC}
          total={total}
          isValid={isAllocationValid}
          onRun={() => setStep("result")}
        />
      )}

      {step === "result" && (
        <ResultCard
          crash={crash}
          startingUsd={STARTING_USD}
          directFinal={result.direct.finalValue}
          gblinFinal={result.gblin.finalValue}
          directDrawdown={result.direct.drawdownPct}
          gblinDrawdown={result.gblin.drawdownPct}
          saved={result.saved}
          onRetry={() => setStep("setup")}
        />
      )}

      <footer
        style={{
          maxWidth: 720,
          margin: "32px auto 0",
          padding: "16px 0",
          borderTop: "1px solid rgba(245,215,122,0.12)",
          color: "#7a6f4f",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        Prices approximated from public market data (CoinGecko / Chainlink
        archives). The simulation assumes zero swap fees and instant rebalance
        — real protocol performance is slightly worse due to gas, slippage and
        keeper lag. Code is open-source:{" "}
        <a
          href="https://github.com/gblinproject/GBLIN-Protocol"
          style={{ color: "#f5d77a" }}
        >
          github.com/gblinproject/GBLIN-Protocol
        </a>
        .
      </footer>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup screen
// ─────────────────────────────────────────────────────────────────────────────

type SetupProps = {
  crash: CrashScenario;
  setCrash: (c: CrashScenario) => void;
  pctBTC: number;
  setPctBTC: (n: number) => void;
  pctETH: number;
  setPctETH: (n: number) => void;
  pctUSDC: number;
  setPctUSDC: (n: number) => void;
  total: number;
  isValid: boolean;
  onRun: () => void;
};

function SetupCard(p: SetupProps) {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitle}>1. Allocate ${STARTING_USD.toLocaleString()}</h2>
      <AllocSlider
        label="cbBTC"
        value={p.pctBTC}
        onChange={p.setPctBTC}
        accent="#f7931a"
      />
      <AllocSlider
        label="WETH"
        value={p.pctETH}
        onChange={p.setPctETH}
        accent="#627eea"
      />
      <AllocSlider
        label="USDC"
        value={p.pctUSDC}
        onChange={p.setPctUSDC}
        accent="#2775ca"
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 8,
          fontSize: 13,
          color: p.isValid ? "#7fdb8a" : "#e57676",
        }}
      >
        <span>Total: {p.total}%</span>
        {!p.isValid && <span>Must sum to 100%</span>}
      </div>

      <h2 style={{ ...sectionTitle, marginTop: 28 }}>2. Pick a crash</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CRASH_LIST.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => p.setCrash(c)}
            style={{
              textAlign: "left",
              cursor: "pointer",
              padding: "14px 16px",
              borderRadius: 12,
              border: `1px solid ${c.id === p.crash.id ? "#f5d77a" : "rgba(245,215,122,0.15)"}`,
              background:
                c.id === p.crash.id
                  ? "rgba(245,215,122,0.08)"
                  : "rgba(245,215,122,0.02)",
              color: "#f5d77a",
              fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15 }}>{c.label}</div>
            <div style={{ color: "#9a8a5c", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
              {c.summary}
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={p.onRun}
        disabled={!p.isValid}
        style={{
          marginTop: 24,
          width: "100%",
          padding: "14px",
          borderRadius: 999,
          background: p.isValid ? "#f5d77a" : "rgba(245,215,122,0.25)",
          color: "#050505",
          border: "none",
          fontWeight: 700,
          fontSize: 15,
          cursor: p.isValid ? "pointer" : "not-allowed",
          letterSpacing: 0.5,
        }}
      >
        Run backtest →
      </button>
    </section>
  );
}

function AllocSlider({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  accent: string;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          color: "#9a8a5c",
          marginBottom: 6,
        }}
      >
        <span style={{ color: accent, fontWeight: 600 }}>{label}</span>
        <span>{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{
          width: "100%",
          accentColor: accent,
          height: 4,
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result screen
// ─────────────────────────────────────────────────────────────────────────────

type ResultProps = {
  crash: CrashScenario;
  startingUsd: number;
  directFinal: number;
  gblinFinal: number;
  directDrawdown: number;
  gblinDrawdown: number;
  saved: number;
  onRetry: () => void;
};

function ResultCard(r: ResultProps) {
  const savedRounded = Math.round(r.saved);
  const directLossPct = -r.directDrawdown * 100;
  const gblinLossPct = -r.gblinDrawdown * 100;

  // Build the share URL embed. The /game page will render the same result
  // when reopened with these query params (see useEffect in CrashShieldGame).
  const shareEmbed = `${SITE_URL}/game?crash=${r.crash.id}&saved=${savedRounded}&direct=${directLossPct.toFixed(1)}&gblin=${gblinLossPct.toFixed(1)}`;

  const shareText =
    r.saved > 0
      ? `just survived the ${r.crash.shortLabel} crash with GBLIN.\n\n` +
        `direct portfolio: ${fmtPct(r.directDrawdown)} (${fmtUsd(r.directFinal - r.startingUsd)})\n` +
        `with GBLIN crash shield: ${fmtPct(r.gblinDrawdown)} (${fmtUsd(r.gblinFinal - r.startingUsd)})\n\n` +
        `saved ${fmtUsd(r.saved)} on a ${fmtUsd(r.startingUsd)} basket. autonomous, on Base.`
      : `ran the ${r.crash.shortLabel} crash test on the GBLIN basket.\n\n` +
        `direct: ${fmtPct(r.directDrawdown)}\n` +
        `with crash shield: ${fmtPct(r.gblinDrawdown)}`;

  const onShare = async () => {
    // Try Mini App SDK first (inside Warpcast / Base app).
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      await sdk.actions.composeCast({
        text: shareText,
        embeds: [shareEmbed],
      });
      return;
    } catch (e) {
      // Not inside a Mini App host — fall back to Warpcast Cast Composer Intent.
      // Reference: https://docs.farcaster.xyz/reference/warpcast/cast-composer-intents
      const intent = new URL("https://warpcast.com/~/compose");
      intent.searchParams.set("text", shareText);
      intent.searchParams.append("embeds[]", shareEmbed);
      window.open(intent.toString(), "_blank", "noopener,noreferrer");
    }
  };

  return (
    <section style={cardStyle}>
      <div style={{ color: "#9a8a5c", fontSize: 12, letterSpacing: 1.5 }}>
        {r.crash.duration.toUpperCase()} · {r.crash.label.toUpperCase()}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <PortfolioBox
          label="Direct hold"
          subtitle="no rebalance"
          startUsd={r.startingUsd}
          finalUsd={r.directFinal}
          drawdownPct={r.directDrawdown}
          highlight={false}
        />
        <PortfolioBox
          label="GBLIN basket"
          subtitle="crash shield armed"
          startUsd={r.startingUsd}
          finalUsd={r.gblinFinal}
          drawdownPct={r.gblinDrawdown}
          highlight={true}
        />
      </div>

      <div
        style={{
          marginTop: 20,
          padding: "18px 20px",
          borderRadius: 14,
          background:
            r.saved > 0
              ? "linear-gradient(135deg, rgba(127, 219, 138, 0.12), rgba(127, 219, 138, 0.04))"
              : "rgba(245,215,122,0.06)",
          border: `1px solid ${r.saved > 0 ? "rgba(127,219,138,0.3)" : "rgba(245,215,122,0.18)"}`,
        }}
      >
        <div style={{ color: "#9a8a5c", fontSize: 12, letterSpacing: 1 }}>
          GBLIN SAVED YOU
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: r.saved > 0 ? "#7fdb8a" : "#f5d77a",
            marginTop: 4,
            letterSpacing: -1,
          }}
        >
          {r.saved > 0 ? "+" : ""}
          {fmtUsd(r.saved)}
        </div>
        <div style={{ color: "#9a8a5c", fontSize: 12, marginTop: 4 }}>
          out of {fmtUsd(r.startingUsd)} starting capital
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
        <button
          type="button"
          onClick={onShare}
          style={primaryBtn}
        >
          Share on Farcaster ↗
        </button>
        <Link href="/buy-gblin" style={primaryBtnLinkOutline}>
          Mint GBLIN now →
        </Link>
        <button type="button" onClick={r.onRetry} style={ghostBtn}>
          Try another crash
        </button>
      </div>
    </section>
  );
}

function PortfolioBox({
  label,
  subtitle,
  startUsd,
  finalUsd,
  drawdownPct,
  highlight,
}: {
  label: string;
  subtitle: string;
  startUsd: number;
  finalUsd: number;
  drawdownPct: number;
  highlight: boolean;
}) {
  const ddColor = drawdownPct < -0.20 ? "#e57676" : drawdownPct < -0.05 ? "#f5d77a" : "#7fdb8a";
  return (
    <div
      style={{
        flex: 1,
        padding: "16px 14px",
        borderRadius: 14,
        background: highlight
          ? "rgba(245,215,122,0.06)"
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${highlight ? "rgba(245,215,122,0.3)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <div style={{ color: "#9a8a5c", fontSize: 11, letterSpacing: 1.2 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ color: "#7a6f4f", fontSize: 11, marginTop: 2 }}>{subtitle}</div>
      <div style={{ color: "#9a8a5c", fontSize: 11, marginTop: 12 }}>
        {fmtUsd(startUsd)} →
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#f5d77a", marginTop: 2 }}>
        {fmtUsd(finalUsd)}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: ddColor, marginTop: 6 }}>
        {fmtPct(drawdownPct)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "24px 20px",
  borderRadius: 18,
  background: "rgba(245,215,122,0.04)",
  border: "1px solid rgba(245,215,122,0.15)",
  backdropFilter: "blur(8px)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#9a8a5c",
  letterSpacing: 1.2,
  textTransform: "uppercase",
  margin: "0 0 12px",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  borderRadius: 999,
  background: "#f5d77a",
  color: "#050505",
  border: "none",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  letterSpacing: 0.4,
};

const primaryBtnLinkOutline: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  borderRadius: 999,
  background: "transparent",
  color: "#f5d77a",
  border: "1px solid #f5d77a",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: 0.4,
  textAlign: "center",
  textDecoration: "none",
  display: "block",
  boxSizing: "border-box",
};

const ghostBtn: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  borderRadius: 999,
  background: "transparent",
  color: "#9a8a5c",
  border: "none",
  fontSize: 13,
  cursor: "pointer",
  letterSpacing: 0.3,
};
