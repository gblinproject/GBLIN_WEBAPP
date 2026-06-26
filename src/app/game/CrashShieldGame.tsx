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
 * GBLIN Crash Shield — "guess the drawdown" challenge.
 *
 * Mechanic: for each real historical crash the player guesses how far the
 * GBLIN basket fell, then sees it against pure BTC / ETH. Score by closeness.
 *
 * Numbers are the REAL peak-to-trough drawdowns from the 10-year on-chain
 * Crash-Shield backtest (production tuning, slow peak decay 15 bps/day,
 * full-slash drawdown 30%). Same dataset as the /frame hook, so the two stay
 * consistent. The stylised short-window simulator (crash-simulator.ts, now
 * ported to the V6 rules) under-represents protection on 3-7 day windows, so
 * the challenge uses the verified backtest figures instead.
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
  btc: "#f7931a",
  eth: "#7b7bff",
};

type Crash = {
  id: string;
  label: string;
  short: string;
  when: string;
  gblin: number;
  btc: number;
  eth: number;
};

const CRASHES: Crash[] = [
  { id: "ftx", label: "FTX collapse", short: "the FTX collapse", when: "Nov 2022", gblin: 5.7, btc: 26.0, eth: 33.1 },
  { id: "covid", label: "COVID crash", short: "the COVID crash", when: "Feb–Apr 2020", gblin: 28.4, btc: 53.2, eth: 61.5 },
  { id: "may2021", label: "May 2021 flush", short: "the May 2021 flush", when: "Apr–Jul 2021", gblin: 31.7, btc: 53.1, eth: 57.3 },
  { id: "bear2022", label: "LUNA + 2022 bear", short: "the 2022 bear", when: "Apr–Dec 2022", gblin: 30.5, btc: 66.2, eth: 71.8 },
  { id: "bear2018", label: "Bear market 2018", short: "the 2018 bear", when: "Jan–Dec 2018", gblin: 41.4, btc: 81.4, eth: 94.0 },
];

const ROUNDS = 3;

const glassCard: React.CSSProperties = {
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
  border: `1px solid ${C.border}`,
  boxShadow:
    "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 24px 60px -28px rgba(0,0,0,0.7)",
};

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

type Step = "intro" | "guess" | "reveal" | "final";

export default function CrashShieldGame() {
  const [deck, setDeck] = useState<Crash[]>(() => shuffle(CRASHES).slice(0, ROUNDS));
  const [step, setStep] = useState<Step>("intro");
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState(30);
  const [total, setTotal] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [shareState, setShareState] = useState<"idle" | "loading">("idle");

  const crash = deck[idx];

  const start = () => {
    setDeck(shuffle(CRASHES).slice(0, ROUNDS));
    setIdx(0);
    setTotal(0);
    setGuess(30);
    setStep("guess");
  };

  const lockIn = () => {
    const sc = Math.max(0, Math.round(100 - Math.abs(guess - crash.gblin) * 3.5));
    setLastScore(sc);
    setTotal((t) => t + sc);
    setStep("reveal");
  };

  const next = () => {
    if (idx < ROUNDS - 1) {
      setIdx((i) => i + 1);
      setGuess(30);
      setStep("guess");
    } else {
      setStep("final");
    }
  };

  const onShare = async (c: Crash) => {
    setShareState("loading");
    const text =
      `When ${c.short} hit, Bitcoin fell -${c.btc}% and Ethereum -${c.eth}%.\n\n` +
      `GBLIN's Crash Shield only fell -${c.gblin}% — it de-risks itself, on-chain, on Base.\n\n` +
      `Run your own crash test 👇`;
    const embed = `${SITE_URL}/game?crash=${c.id}&gblin=${c.gblin}&direct=${c.btc}`;
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
        <section className="gblin-fade-up gblin-glass" style={{ ...glassCard, padding: "20px 16px 16px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
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
                <span className="gblin-grad-text-amber">GBLIN</span> Crash Shield
              </div>
              <div style={{ fontSize: 10.5, color: C.textMute }}>live on Base · 0 admin keys · real backtest data</div>
            </div>
          </div>

          {step === "intro" && (
            <div className="gblin-fade-up">
              <h1 style={{ fontSize: 23, margin: "0 0 10px", fontWeight: 900, letterSpacing: -0.6, lineHeight: 1.15 }}>
                Could you survive a <span className="gblin-grad-text-amber">crypto crash</span> better than GBLIN?
              </h1>
              <p style={{ color: C.textDim, fontSize: 13.5, lineHeight: 1.55, margin: "0 0 18px" }}>
                {ROUNDS} real crashes. Guess how far the GBLIN basket fell, then see it against pure BTC and ETH.
                Numbers from the 10-year on-chain backtest.
              </p>
              <button onClick={start} style={btnGold}>Start — {ROUNDS} rounds</button>
            </div>
          )}

          {step === "guess" && crash && (
            <div className="gblin-fade-up">
              <Dots idx={idx} />
              <div style={{ fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: 1.2, margin: "2px 0 4px" }}>
                Round {idx + 1} / {ROUNDS} · {crash.when}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, margin: "0 0 12px" }}>{crash.label}</div>
              <Row label="Bitcoin dropped" value={crash.btc} color={C.btc} />
              <Row label="Ethereum dropped" value={crash.eth} color={C.eth} />
              <div style={{ fontSize: 16, fontWeight: 600, margin: "16px 0 0" }}>
                How far did <span className="gblin-grad-text-amber">GBLIN</span> fall?
              </div>
              <div style={{ textAlign: "center", fontSize: 40, fontWeight: 800, color: C.amber, letterSpacing: -1, marginTop: 8 }}>
                −{guess}<span style={{ fontSize: 18, color: C.textMute }}>%</span>
              </div>
              <input
                type="range"
                min={0}
                max={95}
                step={1}
                value={guess}
                onChange={(e) => setGuess(Number(e.target.value))}
                style={{ width: "100%", accentColor: C.amber, marginTop: 10 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.textMute, marginTop: 4 }}>
                <span>0% (untouched)</span><span>−95% (rekt)</span>
              </div>
              <button onClick={lockIn} style={{ ...btnGold, marginTop: 18 }}>Lock in guess</button>
            </div>
          )}

          {step === "reveal" && crash && (
            <div className="gblin-fade-up">
              <Dots idx={idx} />
              <div style={{ fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: 1.2, margin: "2px 0 10px" }}>
                {crash.label} · result
              </div>
              <div style={{ textAlign: "center", margin: "0 0 14px" }}>
                <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, color: lastScore >= 70 ? C.emerald : lastScore >= 40 ? C.amber : "#f87171" }}>
                  +{lastScore}
                </div>
                <div style={{ color: C.textDim, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {Math.abs(guess - crash.gblin) <= 5 ? <Check size={14} color={C.emerald} /> : <X size={14} color={C.amber} />}
                  {Math.abs(guess - crash.gblin) <= 5 ? "Spot on." : `You guessed −${guess}%. It was −${crash.gblin}%.`}
                </div>
              </div>
              <Bar label="🛡️ GBLIN Crash Shield" value={crash.gblin} max={Math.max(crash.btc, crash.eth)} color={C.amber} strong />
              <Bar label="Bitcoin" value={crash.btc} max={Math.max(crash.btc, crash.eth)} color={C.btc} />
              <Bar label="Ethereum" value={crash.eth} max={Math.max(crash.btc, crash.eth)} color={C.eth} />
              <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.55, margin: "10px 0 14px" }}>
                GBLIN rotates risk into stables when a drawdown breaches its adaptive threshold — automatically, on-chain. That gap is the whole point.
              </p>
              <button onClick={() => onShare(crash)} disabled={shareState === "loading"} style={btnGold}>
                <Share2 size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
                {shareState === "loading" ? "Opening…" : "Share this result"}
              </button>
              <button onClick={next} style={{ ...btnGhost, marginTop: 9 }}>
                {idx < ROUNDS - 1 ? "Next crash →" : "See final score"}
              </button>
            </div>
          )}

          {step === "final" && (
            <div className="gblin-fade-up">
              <h1 style={{ fontSize: 24, margin: "0 0 8px", fontWeight: 900, letterSpacing: -0.6 }}>
                You scored <span className="gblin-grad-text-amber">{total}</span>/{ROUNDS * 100}
              </h1>
              <p style={{ color: C.textDim, fontSize: 13.5, lineHeight: 1.55, margin: "0 0 18px" }}>
                In every real crash, GBLIN fell far less than holding BTC or ETH — because it de-risks itself. That is the whole point of the basket.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 9 }}>
                <ActionCard href="/buy-gblin" icon={<Sparkles size={16} />} title="Mint GBLIN" subtitle="Buy the basket" tone="amber" />
                <ActionCard href="/rebalance" icon={<Shield size={16} />} title="Trigger rebalance" subtitle="Earn keeper bounty" tone="blue" />
              </div>
              <button onClick={start} style={btnGhost}>
                <RotateCcw size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                Play again
              </button>
            </div>
          )}

          <div style={{ height: 1, background: C.border, margin: "16px -4px 0" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontSize: 11, color: C.textMute, marginTop: 10 }}>
            <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.textMute, textDecoration: "none" }}>
              <BarChart3 size={12} /> Live dashboard
            </a>
            <Link href="/frame" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.textMute, textDecoration: "none" }}>
              cbBTC + WETH + USDC <ArrowRight size={12} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Dots({ idx }: { idx: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
      {Array.from({ length: ROUNDS }).map((_, i) => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: 99, background: i <= idx ? C.amber : "rgba(255,255,255,0.12)" }} />
      ))}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textDim, margin: "5px 0" }}>
      <span>{label}</span>
      <b style={{ color }}>−{value}%</b>
    </div>
  );
}

function Bar({ label, value, max, color, strong = false }: { label: string; value: number; max: number; color: string; strong?: boolean }) {
  return (
    <div style={{ margin: "11px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
        <span style={{ color: strong ? "#fff" : "#cbd5e1", fontWeight: strong ? 700 : 500 }}>{label}</span>
        <b style={{ color }}>−{value}%</b>
      </div>
      <div style={{ height: 12, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, borderRadius: 99, background: color, boxShadow: strong ? `0 0 14px -2px ${color}` : "none" }} />
      </div>
    </div>
  );
}

type Tone = "amber" | "blue";
const TONE: Record<Tone, { from: string; to: string; ring: string; icon: string }> = {
  amber: { from: "rgba(251,191,36,0.18)", to: "rgba(244,63,94,0.06)", ring: "rgba(251,191,36,0.4)", icon: "#fbbf24" },
  blue: { from: "rgba(59,130,246,0.18)", to: "rgba(6,182,212,0.06)", ring: "rgba(59,130,246,0.35)", icon: "#60a5fa" },
};

function ActionCard({ href, icon, title, subtitle, tone }: { href: string; icon: React.ReactNode; title: string; subtitle: string; tone: Tone }) {
  const t = TONE[tone];
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        className="gblin-glass"
        style={{
          padding: 12,
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

const btnGold: React.CSSProperties = {
  display: "block",
  width: "100%",
  border: "none",
  cursor: "pointer",
  borderRadius: 13,
  padding: 14,
  fontSize: 15,
  fontWeight: 800,
  background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
  color: "#1a1405",
};

const btnGhost: React.CSSProperties = {
  display: "block",
  width: "100%",
  cursor: "pointer",
  borderRadius: 13,
  padding: 13,
  fontSize: 14,
  fontWeight: 700,
  background: "rgba(255,255,255,0.03)",
  color: "#cbd5e1",
  border: `1px solid ${C.border}`,
};
