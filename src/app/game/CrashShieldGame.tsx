"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Coins,
  Info,
  RotateCcw,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  normaliseAllocation,
  simulateDirect,
  simulateGblin,
  type Allocation,
} from "@/lib/crash-simulator";
import {
  CRASH_LIST,
  getCrashById,
  type CrashScenario,
} from "@/lib/historical-crashes";

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

const fmtPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

type Step = "setup" | "result";

// ─────────────────────────────────────────────────────────────────────────────
// Top-level component
// ─────────────────────────────────────────────────────────────────────────────

export default function CrashShieldGame() {
  const [step, setStep] = useState<Step>("setup");
  const [crash, setCrash] = useState<CrashScenario>(CRASH_LIST[0]);
  const [pctBTC, setPctBTC] = useState(45);
  const [pctETH, setPctETH] = useState(45);
  const [pctUSDC, setPctUSDC] = useState(10);
  const [showOnboarding, setShowOnboarding] = useState(true);

  // Deep-link: /game?crash=jan2026 auto-opens that result.
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
    // Hide onboarding for returning users
    try {
      if (localStorage.getItem("gblin-game-onboarded") === "1") {
        setShowOnboarding(false);
      }
    } catch {
      // ignore (SSR / privacy mode)
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

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem("gblin-game-onboarded", "1");
    } catch {
      // ignore
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(245,215,122,0.08) 0%, rgba(245,215,122,0) 60%), #050505",
        color: "#f5d77a",
        padding: "20px 16px 80px",
        fontFamily: "Inter, system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <header
        style={{ maxWidth: 720, margin: "0 auto 20px" }}
        className="gblin-fade-up"
      >
        <Link
          href="/"
          style={{
            color: "#9a8a5c",
            fontSize: 12,
            letterSpacing: 0.8,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 0",
          }}
        >
          <ArrowLeft size={14} />
          gblin.digital
        </Link>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background:
                "linear-gradient(135deg, rgba(245,215,122,0.2), rgba(245,215,122,0.05))",
              border: "1px solid rgba(245,215,122,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f5d77a",
            }}
          >
            <Shield size={22} strokeWidth={1.8} />
          </div>
          <div>
            <h1
              style={{
                fontSize: 30,
                margin: 0,
                letterSpacing: -0.8,
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              Survive the Crash
            </h1>
            <div style={{ color: "#9a8a5c", fontSize: 12, marginTop: 4 }}>
              GBLIN Crash Shield · live backtest
            </div>
          </div>
        </div>
      </header>

      {step === "setup" && showOnboarding && (
        <OnboardingHint onDismiss={dismissOnboarding} />
      )}

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

      <Footer />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding hint
// ─────────────────────────────────────────────────────────────────────────────

function OnboardingHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section
      className="gblin-fade-up"
      style={{
        ...glassCard,
        maxWidth: 720,
        margin: "0 auto 14px",
        padding: "14px 18px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        border: "1px solid rgba(127, 219, 138, 0.25)",
        background:
          "linear-gradient(135deg, rgba(127,219,138,0.06), rgba(127,219,138,0.02))",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          minWidth: 28,
          borderRadius: 10,
          background: "rgba(127,219,138,0.14)",
          color: "#7fdb8a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Info size={16} strokeWidth={2} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "#cfeed4", fontWeight: 600 }}>
          First time? Here&apos;s the deal.
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#9a8a5c",
            marginTop: 4,
            lineHeight: 1.55,
          }}
        >
          GBLIN auto-rotates risk assets into stables when a drawdown crosses
          20%. Pick an allocation, pick a real crash, and see what would have
          happened with vs without the Crash Shield.
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: "transparent",
          border: "none",
          color: "#9a8a5c",
          cursor: "pointer",
          fontSize: 12,
          padding: 4,
        }}
        aria-label="Dismiss tip"
      >
        ×
      </button>
    </section>
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
    <section className="gblin-fade-up" style={glassCard}>
      <SectionHeader
        icon={<Coins size={14} />}
        title="01 · Allocate"
        suffix={
          <span style={{ fontSize: 11, color: "#9a8a5c", letterSpacing: 0.6 }}>
            ${STARTING_USD.toLocaleString()} starting capital
          </span>
        }
      />

      <div style={{ marginTop: 14 }}>
        <AllocSlider
          label="cbBTC"
          symbol="₿"
          value={p.pctBTC}
          onChange={p.setPctBTC}
          accent="#f7931a"
        />
        <AllocSlider
          label="WETH"
          symbol="◇"
          value={p.pctETH}
          onChange={p.setPctETH}
          accent="#627eea"
        />
        <AllocSlider
          label="USDC"
          symbol="$"
          value={p.pctUSDC}
          onChange={p.setPctUSDC}
          accent="#2775ca"
        />
      </div>

      <div
        style={{
          marginTop: 14,
          padding: "10px 14px",
          borderRadius: 10,
          background: p.isValid
            ? "rgba(127, 219, 138, 0.08)"
            : "rgba(229, 118, 118, 0.08)",
          border: `1px solid ${p.isValid ? "rgba(127,219,138,0.25)" : "rgba(229,118,118,0.25)"}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
        }}
      >
        <span style={{ color: "#9a8a5c", letterSpacing: 0.4 }}>TOTAL</span>
        <span
          style={{
            color: p.isValid ? "#7fdb8a" : "#e57676",
            fontWeight: 600,
          }}
        >
          {p.total}% {p.isValid ? "" : "(must equal 100%)"}
        </span>
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionHeader icon={<Zap size={14} />} title="02 · Pick a crash" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 14,
          }}
        >
          {CRASH_LIST.map((c) => (
            <CrashCard
              key={c.id}
              crash={c}
              selected={c.id === p.crash.id}
              onSelect={() => p.setCrash(c)}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={p.onRun}
        disabled={!p.isValid}
        style={{
          ...primaryBtn,
          marginTop: 26,
          opacity: p.isValid ? 1 : 0.4,
          cursor: p.isValid ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        Run backtest
        <ArrowRight size={16} strokeWidth={2.5} />
      </button>
    </section>
  );
}

function AllocSlider({
  label,
  symbol,
  value,
  onChange,
  accent,
}: {
  label: string;
  symbol: string;
  value: number;
  onChange: (n: number) => void;
  accent: string;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: `${accent}22`,
              color: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {symbol}
          </span>
          <span style={{ color: "#f5d77a", fontWeight: 600, fontSize: 14 }}>
            {label}
          </span>
        </div>
        <span style={{ color: "#9a8a5c", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
          {value}%
        </span>
      </div>
      <input
        type="range"
        className="gblin-slider"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{
          width: "100%",
          accentColor: accent,
        }}
      />
    </div>
  );
}

function CrashCard({
  crash,
  selected,
  onSelect,
}: {
  crash: CrashScenario;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: "left",
        cursor: "pointer",
        padding: "14px 16px",
        borderRadius: 14,
        border: `1px solid ${selected ? "#f5d77a" : "rgba(245,215,122,0.12)"}`,
        background: selected
          ? "linear-gradient(135deg, rgba(245,215,122,0.10), rgba(245,215,122,0.02))"
          : "rgba(245,215,122,0.02)",
        color: "#f5d77a",
        fontFamily: "inherit",
        transition: "all 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <TrendingDown
            size={16}
            color={selected ? "#e57676" : "#9a8a5c"}
            strokeWidth={2}
          />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{crash.label}</span>
        </div>
        <span
          style={{
            fontSize: 10,
            color: "#9a8a5c",
            letterSpacing: 1,
            textTransform: "uppercase",
            background: "rgba(255,255,255,0.04)",
            padding: "3px 8px",
            borderRadius: 999,
          }}
        >
          {crash.duration}
        </span>
      </div>
      <div
        style={{
          color: "#9a8a5c",
          fontSize: 12,
          marginTop: 8,
          lineHeight: 1.55,
        }}
      >
        {crash.summary}
      </div>
    </button>
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
  const [shareState, setShareState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const savedRounded = Math.round(r.saved);
  const directLossPct = -r.directDrawdown * 100;
  const gblinLossPct = -r.gblinDrawdown * 100;

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
    setShareState("loading");
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      await sdk.actions.composeCast({
        text: shareText,
        embeds: [shareEmbed],
      });
      setShareState("idle");
    } catch {
      // Not in a Mini App host — fall back to Warpcast Cast Composer Intent.
      try {
        const intent = new URL("https://warpcast.com/~/compose");
        intent.searchParams.set("text", shareText);
        intent.searchParams.append("embeds[]", shareEmbed);
        window.open(intent.toString(), "_blank", "noopener,noreferrer");
        setShareState("idle");
      } catch {
        setShareState("error");
      }
    }
  };

  return (
    <section className="gblin-fade-up" style={glassCard}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(245,215,122,0.06)",
            border: "1px solid rgba(245,215,122,0.18)",
            fontSize: 11,
            color: "#9a8a5c",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          <TrendingDown size={12} />
          {r.crash.shortLabel} · {r.crash.duration}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "#7fdb8a",
            letterSpacing: 0.5,
          }}
        >
          <ShieldCheck size={12} strokeWidth={2.5} />
          shield armed
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <PortfolioBox
          label="Direct hold"
          subtitle="no rebalance"
          startUsd={r.startingUsd}
          finalUsd={r.directFinal}
          drawdownPct={r.directDrawdown}
          accent="#e57676"
        />
        <PortfolioBox
          label="GBLIN basket"
          subtitle="crash shield"
          startUsd={r.startingUsd}
          finalUsd={r.gblinFinal}
          drawdownPct={r.gblinDrawdown}
          accent="#7fdb8a"
          highlight
        />
      </div>

      <SavedHero saved={r.saved} startingUsd={r.startingUsd} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        <button type="button" onClick={onShare} style={primaryBtn}>
          {shareState === "loading" ? (
            <>
              <span className="gblin-spin" style={spinnerStyle} />
              Opening composer…
            </>
          ) : (
            <>
              <Share2 size={16} strokeWidth={2.5} />
              Share on Farcaster
            </>
          )}
        </button>
        {shareState === "error" && (
          <div style={{ fontSize: 12, color: "#e57676", textAlign: "center" }}>
            Share failed. Try again or copy the link manually.
          </div>
        )}
        <Link href="/buy-gblin" style={primaryLinkOutline}>
          <Sparkles size={14} strokeWidth={2.5} />
          Mint GBLIN
        </Link>
        <button type="button" onClick={r.onRetry} style={ghostBtn}>
          <RotateCcw size={13} />
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
  accent,
  highlight = false,
}: {
  label: string;
  subtitle: string;
  startUsd: number;
  finalUsd: number;
  drawdownPct: number;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "14px 14px",
        borderRadius: 14,
        background: highlight
          ? "linear-gradient(135deg, rgba(127,219,138,0.10), rgba(127,219,138,0.02))"
          : "rgba(255,255,255,0.02)",
        border: highlight
          ? "1px solid rgba(127,219,138,0.28)"
          : "1px solid rgba(255,255,255,0.06)",
        position: "relative",
      }}
    >
      <div
        style={{
          color: "#9a8a5c",
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ color: "#7a6f4f", fontSize: 11, marginTop: 2 }}>{subtitle}</div>
      <div style={{ color: "#9a8a5c", fontSize: 11, marginTop: 12, display: "flex", alignItems: "center", gap: 4 }}>
        {fmtUsd(startUsd)}
        <ArrowRight size={11} />
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#f5d77a",
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -0.3,
        }}
      >
        {fmtUsd(finalUsd)}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: accent,
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {drawdownPct < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
        {fmtPct(drawdownPct)}
      </div>
    </div>
  );
}

/**
 * Hero callout with count-up animation on the saved $X figure.
 * Pure CSS / requestAnimationFrame — no extra dependency.
 */
function SavedHero({ saved, startingUsd }: { saved: number; startingUsd: number }) {
  const positive = saved > 0;
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (ref.current !== null) cancelAnimationFrame(ref.current);
    const start = performance.now();
    const duration = 900;
    const from = 0;
    const to = saved;

    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplay(from + (to - from) * eased);
      if (elapsed < 1) {
        ref.current = requestAnimationFrame(tick);
      }
    };

    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current !== null) cancelAnimationFrame(ref.current);
    };
  }, [saved]);

  return (
    <div
      style={{
        marginTop: 18,
        padding: "20px 22px",
        borderRadius: 16,
        background: positive
          ? "linear-gradient(135deg, rgba(127,219,138,0.16), rgba(127,219,138,0.04))"
          : "rgba(245,215,122,0.06)",
        border: `1px solid ${positive ? "rgba(127,219,138,0.35)" : "rgba(245,215,122,0.18)"}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 110,
          height: 110,
          borderRadius: "50%",
          background: positive
            ? "radial-gradient(circle, rgba(127,219,138,0.2) 0%, transparent 70%)"
            : "transparent",
          filter: "blur(6px)",
        }}
      />
      <div
        style={{
          color: "#9a8a5c",
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <ShieldCheck size={12} strokeWidth={2.5} />
        GBLIN saved you
      </div>
      <div
        style={{
          fontSize: 42,
          fontWeight: 800,
          color: positive ? "#7fdb8a" : "#f5d77a",
          marginTop: 6,
          letterSpacing: -1.2,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.05,
        }}
      >
        {positive ? "+" : ""}
        {fmtUsd(display)}
      </div>
      <div
        style={{
          color: "#9a8a5c",
          fontSize: 12,
          marginTop: 6,
        }}
      >
        on {fmtUsd(startingUsd)} starting capital ·{" "}
        <span style={{ color: positive ? "#7fdb8a" : "#9a8a5c" }}>
          {positive ? `${fmtPct(saved / startingUsd, 1)} better outcome` : "no improvement here"}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer + shared atoms
// ─────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      style={{
        maxWidth: 720,
        margin: "32px auto 0",
        padding: "16px 4px",
        color: "#7a6f4f",
        fontSize: 11,
        lineHeight: 1.6,
        textAlign: "center",
      }}
    >
      Prices approximated from public market data. The simulator assumes zero
      swap fees and instant rebalance — real protocol performance is slightly
      worse due to gas, slippage and keeper lag.
      <div style={{ marginTop: 6 }}>
        Open source ·{" "}
        <a
          href="https://github.com/gblinproject/GBLIN-Protocol"
          style={{ color: "#9a8a5c", textDecoration: "underline" }}
        >
          github.com/gblinproject/GBLIN-Protocol
        </a>
      </div>
    </footer>
  );
}

function SectionHeader({
  icon,
  title,
  suffix,
}: {
  icon: React.ReactNode;
  title: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          color: "#9a8a5c",
          fontSize: 12,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {icon}
        {title}
      </div>
      {suffix}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "22px 20px",
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(245,215,122,0.04) 0%, rgba(245,215,122,0.015) 100%)",
  border: "1px solid rgba(245,215,122,0.12)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  boxShadow:
    "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.6)",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 14,
  background: "linear-gradient(180deg, #f5d77a 0%, #e8c463 100%)",
  color: "#050505",
  border: "none",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  letterSpacing: 0.3,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow:
    "0 1px 0 0 rgba(255,255,255,0.4) inset, 0 8px 24px -8px rgba(245,215,122,0.4)",
  transition: "transform 0.12s ease",
};

const primaryLinkOutline: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 14,
  background: "rgba(245,215,122,0.04)",
  color: "#f5d77a",
  border: "1px solid rgba(245,215,122,0.35)",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: 0.3,
  textAlign: "center",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxSizing: "border-box",
};

const ghostBtn: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 14,
  background: "transparent",
  color: "#9a8a5c",
  border: "none",
  fontSize: 13,
  cursor: "pointer",
  letterSpacing: 0.3,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const spinnerStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px solid rgba(5,5,5,0.25)",
  borderTopColor: "#050505",
  display: "inline-block",
};
