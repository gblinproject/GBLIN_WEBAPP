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
  BASE_ALLOCATION,
  CRASH_LIST,
  getCrashById,
  getCorrectAllocation,
  type CrashScenario,
} from "@/lib/historical-crashes";

const SITE_URL = "https://gblin.digital";
const STARTING_USD = 10_000;
const DEFAULT_ALLOCATION: Allocation = BASE_ALLOCATION;
const WIN_TOLERANCE = 0; // exact match required to win

// 2026 palette
const C = {
  text: "#ffffff",
  textDim: "#94a3b8",
  textMute: "#64748b",
  bg: "#0a0b14",
  surface: "rgba(255,255,255,0.03)",
  surfaceHi: "rgba(255,255,255,0.06)",
  border: "rgba(148,163,184,0.14)",
  borderHi: "rgba(148,163,184,0.28)",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  emerald: "#10b981",
  rose: "#f43f5e",
  amber: "#fbbf24",
  violet: "#a855f7",
};

const fmtUsd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const fmtPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

type Step = "setup" | "result" | "victory";

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
  const [isWinner, setIsWinner] = useState(false);

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
    // Simulate always using the GBLIN base allocation (protocol defaults)
    // regardless of what the user guessed — the simulation is fixed.
    const direct = simulateDirect(STARTING_USD, DEFAULT_ALLOCATION, crash.trajectory);
    const gblin = simulateGblin(STARTING_USD, DEFAULT_ALLOCATION, crash.trajectory);
    const saved = gblin.finalValue - direct.finalValue;
    // Correct answer: what GBLIN actually ends up at after crash
    const correct = getCorrectAllocation(crash);
    return { direct, gblin, saved, correct };
  }, [crash]);

  const checkWin = () => {
    const { correct } = result;
    const won =
      Math.abs(pctBTC - correct.cbBTC) <= WIN_TOLERANCE &&
      Math.abs(pctETH - correct.weth) <= WIN_TOLERANCE &&
      Math.abs(pctUSDC - correct.usdc) <= WIN_TOLERANCE;
    setIsWinner(won);
    setStep("result");
  };

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
      className="gblin-mesh"
      style={{
        minHeight: "100vh",
        color: C.text,
        padding: "20px 16px 80px",
        fontFamily: "Inter, system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <header
        style={{ maxWidth: 720, margin: "0 auto 22px" }}
        className="gblin-fade-up"
      >
        <Link
          href="/"
          style={{
            color: C.textDim,
            fontSize: 12,
            letterSpacing: 0.6,
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
            gap: 14,
            marginTop: 14,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${C.blue} 0%, ${C.violet} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow:
                "0 12px 32px -10px rgba(59,130,246,0.6), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <Shield size={22} strokeWidth={2.2} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h1
              style={{
                fontSize: 32,
                margin: 0,
                letterSpacing: -1,
                fontWeight: 800,
                lineHeight: 1.05,
                color: C.text,
              }}
            >
              Survive the{" "}
              <span className="gblin-grad-text">Crash</span>
            </h1>
            <div
              style={{
                color: C.textDim,
                fontSize: 12,
                marginTop: 4,
                letterSpacing: 0.4,
              }}
            >
              GBLIN Crash Shield
              <span style={{ color: C.textMute }}> · live backtest</span>
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
          setCrash={(c) => { setCrash(c); setIsWinner(false); }}
          pctBTC={pctBTC}
          setPctBTC={setPctBTC}
          pctETH={pctETH}
          setPctETH={setPctETH}
          pctUSDC={pctUSDC}
          setPctUSDC={setPctUSDC}
          total={total}
          isValid={isAllocationValid}
          onRun={checkWin}
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
          isWinner={isWinner}
          correctAllocation={result.correct}
          userAllocation={{ cbBTC: pctBTC, weth: pctETH, usdc: pctUSDC }}
          onRetry={() => { setStep("setup"); setIsWinner(false); }}
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
        maxWidth: 720,
        margin: "0 auto 14px",
        padding: "14px 18px",
        borderRadius: 16,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        border: `1px solid rgba(34, 211, 238, 0.28)`,
        background:
          "linear-gradient(135deg, rgba(34,211,238,0.10) 0%, rgba(59,130,246,0.04) 100%)",
        boxShadow: "0 8px 32px -16px rgba(34,211,238,0.4)",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          minWidth: 30,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${C.cyan}, ${C.blue})`,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        <Info size={16} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
          First time? Here&apos;s the deal.
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: C.textDim,
            marginTop: 4,
            lineHeight: 1.55,
          }}
        >
          GBLIN auto-rotates into stables when a drawdown crosses 20%.
          Guess how GBLIN reallocated during a real crash (±12% tolerance).
          If you guess right → you win. Share the result on Farcaster every Sunday for a chance to win $10.
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: "transparent",
          border: "none",
          color: C.textMute,
          cursor: "pointer",
          fontSize: 18,
          padding: 4,
          lineHeight: 1,
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
          <span style={{ fontSize: 11, color: C.textMute, letterSpacing: 0.6 }}>
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
          accent="#a855f7"
        />
        <AllocSlider
          label="USDC"
          symbol="$"
          value={p.pctUSDC}
          onChange={p.setPctUSDC}
          accent="#22d3ee"
        />
      </div>

      <div
        style={{
          marginTop: 14,
          padding: "10px 14px",
          borderRadius: 12,
          background: p.isValid
            ? "linear-gradient(135deg, rgba(16,185,129,0.14), rgba(16,185,129,0.04))"
            : "linear-gradient(135deg, rgba(244,63,94,0.12), rgba(244,63,94,0.03))",
          border: `1px solid ${p.isValid ? "rgba(16,185,129,0.35)" : "rgba(244,63,94,0.32)"}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
        }}
      >
        <span style={{ color: C.textDim, letterSpacing: 0.4, fontWeight: 600 }}>
          TOTAL
        </span>
        <span
          style={{
            color: p.isValid ? C.emerald : C.rose,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
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
          marginTop: 28,
          opacity: p.isValid ? 1 : 0.45,
          cursor: p.isValid ? "pointer" : "not-allowed",
        }}
      >
        Submit my guess
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: `${accent}28`,
              color: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              border: `1px solid ${accent}40`,
            }}
          >
            {symbol}
          </span>
          <span style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>
            {label}
          </span>
        </div>
        <span
          style={{
            color: C.text,
            fontSize: 14,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}%
        </span>
      </div>
      <input
        type="range"
        className="gblin-slider"
        min={0}
        max={100}
        step={1}
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
        border: `1px solid ${selected ? "rgba(244, 63, 94, 0.45)" : C.border}`,
        background: selected
          ? "linear-gradient(135deg, rgba(244,63,94,0.14) 0%, rgba(168,85,247,0.06) 100%)"
          : C.surface,
        color: C.text,
        fontFamily: "inherit",
        transition: "transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.18s ease, background 0.18s ease",
        boxShadow: selected
          ? "0 0 0 1px rgba(244,63,94,0.25), 0 12px 32px -16px rgba(244,63,94,0.5)"
          : "none",
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: selected
                ? `linear-gradient(135deg, ${C.rose}, ${C.amber})`
                : "rgba(148,163,184,0.10)",
              color: selected ? "#fff" : C.textDim,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingDown size={14} strokeWidth={2.4} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{crash.label}</span>
        </div>
        <span
          style={{
            fontSize: 10,
            color: C.textDim,
            letterSpacing: 1,
            textTransform: "uppercase",
            background: "rgba(148,163,184,0.10)",
            padding: "3px 9px",
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          {crash.duration}
        </span>
      </div>
      <div
        style={{
          color: C.textDim,
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
  isWinner: boolean;
  correctAllocation: { cbBTC: number; weth: number; usdc: number };
  userAllocation: { cbBTC: number; weth: number; usdc: number };
  onRetry: () => void;
};

function ResultCard(r: ResultProps) {
  const [shareState, setShareState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const savedRounded = Math.round(r.saved);
  const directLossPct = -r.directDrawdown * 100;
  const gblinLossPct = -r.gblinDrawdown * 100;

  const shareEmbed = `${SITE_URL}/game?crash=${r.crash.id}&saved=${savedRounded}&direct=${directLossPct.toFixed(1)}&gblin=${gblinLossPct.toFixed(1)}${r.isWinner ? "&won=true" : ""}`;

  const shareText = r.isWinner
    ? `I just won the GBLIN Crash Shield challenge!\n\n` +
      `I correctly predicted how GBLIN would reallocate during the ${r.crash.shortLabel} crash.\n` +
      `GBLIN saved ${fmtUsd(r.saved)} on a ${fmtUsd(r.startingUsd)} basket vs direct hold.\n\n` +
      `Try it yourself → gblin.digital/game\nEvery Sunday the creator picks a random winner for $10.`
    : r.saved > 0
      ? `just ran the ${r.crash.shortLabel} crash test on GBLIN.\n\n` +
        `direct portfolio: ${fmtPct(r.directDrawdown)} | with Crash Shield: ${fmtPct(r.gblinDrawdown)}\n` +
        `GBLIN saved ${fmtUsd(r.saved)} on a ${fmtUsd(r.startingUsd)} basket. autonomous, on Base.`
      : `ran the ${r.crash.shortLabel} crash test on the GBLIN basket.\n\n` +
        `direct: ${fmtPct(r.directDrawdown)} | with crash shield: ${fmtPct(r.gblinDrawdown)}`;

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
      {/* Win / Loss banner */}
      {r.isWinner ? (
        <div style={{
          padding: "14px 18px",
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(251,191,36,0.22), rgba(16,185,129,0.12))",
          border: "1px solid rgba(251,191,36,0.5)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          boxShadow: "0 0 0 1px rgba(251,191,36,0.15), 0 12px 32px -12px rgba(251,191,36,0.4)",
        }}>
          <Sparkles size={20} color="#fbbf24" strokeWidth={2.2} />
          <div>
            <div style={{ color: "#fbbf24", fontWeight: 800, fontSize: 15, letterSpacing: -0.2 }}>
              You nailed it! Correct allocation guessed.
            </div>
            <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>
              Share on Farcaster every Sunday for a chance to win $10
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          padding: "12px 16px",
          borderRadius: 14,
          background: "rgba(244,63,94,0.08)",
          border: "1px solid rgba(244,63,94,0.25)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 16,
        }}>
          <TrendingDown size={16} color="#fb7185" style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <div style={{ color: "#fb7185", fontWeight: 700, fontSize: 13 }}>
              Wrong guess — try again.
            </div>
            <div style={{ color: C.textMute, fontSize: 11, marginTop: 2 }}>
              GBLIN would have saved you {r.saved > 0 ? `$${Math.round(r.saved).toLocaleString("en-US")}` : "$0"} on a $10,000 basket. Can you guess how?
            </div>
          </div>
        </div>
      )}

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
            background: "linear-gradient(135deg, rgba(244,63,94,0.15), rgba(168,85,247,0.06))",
            border: "1px solid rgba(244,63,94,0.32)",
            fontSize: 11,
            color: "#fda4af",
            letterSpacing: 0.8,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <TrendingDown size={12} strokeWidth={2.5} />
          {r.crash.shortLabel} · {r.crash.duration}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: C.emerald,
            letterSpacing: 0.5,
            fontWeight: 600,
          }}
        >
          <span
            className="gblin-blink"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: C.emerald,
              boxShadow: `0 0 10px ${C.emerald}`,
            }}
          />
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
          accent={C.rose}
        />
        <PortfolioBox
          label="GBLIN basket"
          subtitle="crash shield"
          startUsd={r.startingUsd}
          finalUsd={r.gblinFinal}
          drawdownPct={r.gblinDrawdown}
          accent={C.emerald}
          highlight
        />
      </div>

      <SavedHero saved={r.saved} startingUsd={r.startingUsd} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 22,
        }}
      >
        <button
          type="button"
          onClick={onShare}
          style={{
            ...primaryBtn,
            ...(r.isWinner ? {
              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 12px 32px -10px rgba(251,191,36,0.6)",
            } : {}),
          }}
        >
          {shareState === "loading" ? (
            <>
              <span className="gblin-spin" style={spinnerStyle} />
              Opening composer…
            </>
          ) : r.isWinner ? (
            <>
              <Sparkles size={16} strokeWidth={2.6} color="#0a0b14" />
              <span style={{ color: "#0a0b14" }}>Share win — enter the $10 draw</span>
            </>
          ) : (
            <>
              <Share2 size={16} strokeWidth={2.6} />
              Share on Farcaster
            </>
          )}
        </button>
        {shareState === "error" && (
          <div style={{ fontSize: 12, color: C.rose, textAlign: "center" }}>
            Share failed. Try again or copy the link manually.
          </div>
        )}
        <Link href="/buy-gblin" style={primaryLinkOutline}>
          <Sparkles size={14} strokeWidth={2.6} />
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
          ? "linear-gradient(135deg, rgba(16,185,129,0.14), rgba(34,211,238,0.04))"
          : C.surface,
        border: highlight
          ? "1px solid rgba(16,185,129,0.32)"
          : `1px solid ${C.border}`,
        boxShadow: highlight
          ? "0 0 0 1px rgba(16,185,129,0.10), 0 12px 32px -16px rgba(16,185,129,0.45)"
          : "none",
        position: "relative",
      }}
    >
      <div
        style={{
          color: C.textDim,
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ color: C.textMute, fontSize: 11, marginTop: 2 }}>
        {subtitle}
      </div>
      <div
        style={{
          color: C.textMute,
          fontSize: 11,
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmtUsd(startUsd)}
        <ArrowRight size={11} />
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: C.text,
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -0.4,
        }}
      >
        {fmtUsd(finalUsd)}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: accent,
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {drawdownPct < 0 ? (
          <TrendingDown size={12} strokeWidth={2.5} />
        ) : (
          <TrendingUp size={12} strokeWidth={2.5} />
        )}
        {fmtPct(drawdownPct)}
      </div>
    </div>
  );
}

/**
 * Hero callout with count-up animation on the saved $X figure.
 */
function SavedHero({
  saved,
  startingUsd,
}: {
  saved: number;
  startingUsd: number;
}) {
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
        padding: "22px 22px",
        borderRadius: 18,
        background: positive
          ? "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(34,211,238,0.08) 50%, rgba(59,130,246,0.06) 100%)"
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${positive ? "rgba(16,185,129,0.4)" : C.border}`,
        position: "relative",
        overflow: "hidden",
        boxShadow: positive
          ? "0 0 0 1px rgba(16,185,129,0.12), 0 24px 48px -24px rgba(16,185,129,0.5)"
          : "none",
      }}
    >
      {positive && (
        <>
          <div
            style={{
              position: "absolute",
              top: -50,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 70%)",
              filter: "blur(20px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -40,
              left: -30,
              width: 150,
              height: 150,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(34,211,238,0.25) 0%, transparent 70%)",
              filter: "blur(20px)",
              pointerEvents: "none",
            }}
          />
        </>
      )}
      <div
        style={{
          color: positive ? "#a7f3d0" : C.textDim,
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 700,
          position: "relative",
        }}
      >
        <ShieldCheck size={12} strokeWidth={2.6} />
        GBLIN saved you
      </div>
      <div
        className={positive ? "gblin-grad-text-emerald" : ""}
        style={{
          fontSize: 48,
          fontWeight: 900,
          color: positive ? undefined : C.text,
          marginTop: 8,
          letterSpacing: -1.6,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.0,
          position: "relative",
        }}
      >
        {positive ? "+" : ""}
        {fmtUsd(display)}
      </div>
      <div
        style={{
          color: C.textDim,
          fontSize: 12.5,
          marginTop: 8,
          position: "relative",
        }}
      >
        on {fmtUsd(startingUsd)} starting capital ·{" "}
        <span
          style={{
            color: positive ? C.emerald : C.textDim,
            fontWeight: 600,
          }}
        >
          {positive
            ? `${fmtPct(saved / startingUsd, 1)} better outcome`
            : "no improvement here"}
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
        color: C.textMute,
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
          style={{ color: C.textDim, textDecoration: "underline" }}
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
          color: C.textDim,
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          fontWeight: 700,
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
// Style atoms
// ─────────────────────────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "22px 20px",
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
  border: `1px solid ${C.border}`,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow:
    "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 24px 60px -28px rgba(0,0,0,0.7)",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 14,
  background: `linear-gradient(135deg, ${C.blue} 0%, ${C.cyan} 100%)`,
  color: "#ffffff",
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
    "inset 0 1px 0 rgba(255,255,255,0.25), 0 12px 32px -10px rgba(59,130,246,0.6)",
  transition: "transform 0.12s ease, filter 0.12s ease",
};

const primaryLinkOutline: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 14,
  background: "rgba(251, 191, 36, 0.08)",
  color: "#fbbf24",
  border: "1px solid rgba(251, 191, 36, 0.4)",
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
  color: C.textDim,
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
  border: "2px solid rgba(255,255,255,0.3)",
  borderTopColor: "#ffffff",
  display: "inline-block",
};
