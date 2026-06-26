"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  RotateCcw,
  Share2,
  Shield,
  Sparkles,
  X,
} from "lucide-react";

/**
 * FrameHook — the interactive, feed-first entry point for the GBLIN Mini App.
 *
 * Why this shape: the highest-visibility mini apps on Farcaster (June 2026) lead
 * with an INSTANT interactive moment + a shareable result, not a static landing
 * card (ref: Farcaster Mini Apps spec + Builders Garden "viral mini apps" playbook).
 * The hook here uses GBLIN's real differentiator — how little it drops in a real
 * crash — as a one-tap guess that reveals a surprising number, then funnels into
 * Share → Mint → full game. Numbers come from the 10y on-chain Crash-Shield backtest.
 */

const SITE_URL = "https://gblin.digital";
const DASHBOARD_URL = "https://dune.com/gblin/dashboard";

const C = {
  text: "#ffffff",
  textDim: "#94a3b8",
  textMute: "#64748b",
  border: "rgba(148,163,184,0.14)",
  emerald: "#10b981",
  amber: "#fbbf24",
  rose: "#f43f5e",
  blue: "#3b82f6",
  btc: "#f7931a",
  eth: "#7b7bff",
};

// Real drawdowns from the 10y backtest (peak→trough within each crash window).
type Crash = {
  id: string;
  label: string;
  short: string;
  gblin: number;
  btc: number;
  eth: number;
  options: number[]; // guess choices (one equals gblin)
};

const CRASHES: Crash[] = [
  { id: "ftx", label: "FTX collapse · Nov 2022", short: "FTX collapse", gblin: 5.7, btc: 26.0, eth: 33.1, options: [5.7, 17, 28] },
  { id: "luna", label: "LUNA + 2022 bear", short: "the 2022 bear", gblin: 30.5, btc: 66.2, eth: 71.8, options: [12, 30.5, 55] },
  { id: "covid", label: "COVID crash · Mar 2020", short: "the COVID crash", gblin: 28.4, btc: 53.2, eth: 61.5, options: [9, 28.4, 47] },
  { id: "bear2018", label: "Bear market 2018", short: "the 2018 bear", gblin: 41.4, btc: 81.4, eth: 94.0, options: [21, 41.4, 68] },
];

const glassCard: React.CSSProperties = {
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
  border: `1px solid ${C.border}`,
  boxShadow:
    "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 24px 60px -28px rgba(0,0,0,0.7)",
};

export default function FrameHook() {
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [shareState, setShareState] = useState<"idle" | "loading">("idle");

  const crash = CRASHES[round % CRASHES.length];
  const revealed = picked !== null;
  const correct = picked === crash.gblin;
  const maxBar = Math.max(crash.btc, crash.eth, crash.gblin);

  const onShare = async () => {
    setShareState("loading");
    const text =
      `When ${crash.short} hit, Bitcoin fell -${crash.btc}% and Ethereum -${crash.eth}%.\n\n` +
      `GBLIN's Crash Shield only fell -${crash.gblin}% — it de-risks itself, on-chain, on Base.\n\n` +
      `Could you have guessed it? Try the challenge 👇`;
    const embed = `${SITE_URL}/frame`;
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      await sdk.actions.composeCast({ text, embeds: [embed] });
    } catch {
      try {
        const intent = new URL("https://warpcast.com/~/compose");
        intent.searchParams.set("text", text);
        intent.searchParams.append("embeds[]", embed);
        window.open(intent.toString(), "_blank", "noopener,noreferrer");
      } catch {
        /* ignore */
      }
    }
    setShareState("idle");
  };

  return (
    <main
      className="gblin-mesh"
      style={{
        minHeight: "100vh",
        color: C.text,
        padding: "20px 14px 32px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <section
          className="gblin-fade-up gblin-glass"
          style={{ ...glassCard, padding: "20px 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png"
              alt="GBLIN logo"
              width={36}
              height={36}
              style={{ borderRadius: 9, objectFit: "contain" }}
            />
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.3 }}>
                <span className="gblin-grad-text-amber">GBLIN</span>
              </div>
              <div style={{ fontSize: 10.5, color: C.textMute, letterSpacing: 0.3 }}>
                live on Base · 0 admin keys
              </div>
            </div>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                color: "#a7f3d0",
                border: "1px solid rgba(16,185,129,0.35)",
                background: "rgba(16,185,129,0.10)",
                padding: "4px 9px",
                borderRadius: 999,
                letterSpacing: 0.6,
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Crash Shield
            </span>
          </div>

          {/* Hook headline */}
          <h1 style={{ fontSize: 22, margin: 0, letterSpacing: -0.6, fontWeight: 900, lineHeight: 1.15 }}>
            {crash.short[0].toUpperCase() + crash.short.slice(1)}:{" "}
            <span style={{ color: C.btc }}>BTC −{crash.btc}%</span>,{" "}
            <span style={{ color: C.eth }}>ETH −{crash.eth}%</span>.
            <br />
            How far did <span className="gblin-grad-text-amber">GBLIN</span> fall?
          </h1>

          {/* Interactive guess (one tap) */}
          {!revealed ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {crash.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPicked(opt)}
                  className="gblin-glass"
                  style={{
                    padding: "16px 6px",
                    borderRadius: 14,
                    border: `1px solid ${C.border}`,
                    background: "linear-gradient(135deg, rgba(251,191,36,0.10), rgba(244,63,94,0.04))",
                    color: C.text,
                    fontWeight: 800,
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  −{opt}%
                </button>
              ))}
            </div>
          ) : (
            <div className="gblin-fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* verdict */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${correct ? "rgba(16,185,129,0.4)" : "rgba(251,191,36,0.35)"}`,
                  background: correct
                    ? "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.05))"
                    : "linear-gradient(135deg, rgba(251,191,36,0.14), rgba(244,63,94,0.05))",
                }}
              >
                {correct ? <Check size={18} color={C.emerald} /> : <X size={18} color={C.amber} />}
                <div style={{ fontSize: 13, fontWeight: 700, color: correct ? "#a7f3d0" : "#fde68a" }}>
                  {correct
                    ? "Spot on — you get it."
                    : `It was only −${crash.gblin}%. GBLIN held up better than you guessed.`}
                </div>
              </div>

              {/* bars */}
              <Bar label="🛡️ GBLIN Crash Shield" value={crash.gblin} max={maxBar} color={C.amber} strong />
              <Bar label="Bitcoin" value={crash.btc} max={maxBar} color={C.btc} />
              <Bar label="Ethereum" value={crash.eth} max={maxBar} color={C.eth} />

              <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textDim, lineHeight: 1.55 }}>
                GBLIN rotates risk into stables when drawdowns breach its adaptive
                threshold — automatically, on-chain. That gap is the whole point.
              </p>
            </div>
          )}

          {/* Actions */}
          {revealed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <button
                onClick={onShare}
                disabled={shareState === "loading"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "13px",
                  borderRadius: 13,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 14.5,
                  background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                  color: "#1a1405",
                }}
              >
                <Share2 size={16} /> {shareState === "loading" ? "Opening…" : "Share this result"}
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                <ActionCard href="/buy-gblin" icon={<Sparkles size={16} />} title="Mint GBLIN" subtitle="Buy the basket" tone="amber" />
                <ActionCard href="/game" icon={<Shield size={16} />} title="Full challenge" subtitle="Backtest real crashes" tone="blue" />
              </div>

              <button
                onClick={() => {
                  setPicked(null);
                  setRound((r) => r + 1);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "11px",
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: "rgba(255,255,255,0.03)",
                  color: C.textDim,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={14} /> Try another crash
              </button>
            </div>
          )}

          {/* Footer */}
          <div style={{ height: 1, background: C.border, margin: "2px -4px 0" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontSize: 11, color: C.textMute }}>
            <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.textMute, textDecoration: "none" }}>
              <BarChart3 size={12} /> Live dashboard
            </a>
            <Link href="/buy-gblin" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.textMute, textDecoration: "none" }}>
              cbBTC + WETH + USDC <ArrowRight size={12} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Bar({
  label,
  value,
  max,
  color,
  strong = false,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  strong?: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
        <span style={{ color: strong ? "#fff" : "#cbd5e1", fontWeight: strong ? 700 : 500 }}>{label}</span>
        <b style={{ color }}>−{value}%</b>
      </div>
      <div style={{ height: 12, background: "rgba(255,255,255,0.05)", borderRadius: 999, overflow: "hidden" }}>
        <div
          className="gblin-bar-grow"
          style={{
            height: "100%",
            width: `${(value / max) * 100}%`,
            borderRadius: 999,
            background: color,
            boxShadow: strong ? `0 0 14px -2px ${color}` : "none",
          }}
        />
      </div>
    </div>
  );
}

type Tone = "amber" | "blue";
const TONE: Record<Tone, { from: string; to: string; ring: string; icon: string }> = {
  amber: { from: "rgba(251,191,36,0.18)", to: "rgba(244,63,94,0.06)", ring: "rgba(251,191,36,0.4)", icon: "#fbbf24" },
  blue: { from: "rgba(59,130,246,0.18)", to: "rgba(6,182,212,0.06)", ring: "rgba(59,130,246,0.35)", icon: "#60a5fa" },
};

function ActionCard({
  href,
  icon,
  title,
  subtitle,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: Tone;
}) {
  const t = TONE[tone];
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        className="gblin-glass"
        style={{
          padding: "12px",
          borderRadius: 14,
          border: `1px solid ${t.ring}`,
          background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          height: "100%",
        }}
      >
        <div style={{ color: t.icon }}>{icon}</div>
        <div>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{title}</div>
          <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
    </Link>
  );
}
