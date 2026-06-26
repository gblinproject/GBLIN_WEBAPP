"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2, Share2, Shield, Sparkles, Wallet } from "lucide-react";
import { CRASHES, worstCrash, type ValueWeights } from "@/lib/crash-data";

/**
 * PortfolioCheck — the personalised "one-tap utility" loop.
 *
 * Connects the user's wallet, reads their cbBTC / WETH / native ETH / USDC on
 * Base, works out their value allocation, then shows how far THEIR portfolio
 * would have fallen in the worst real crash vs the GBLIN basket. Inherently
 * shareable ("my portfolio would have dropped -71%, GBLIN -30%") and proves the
 * product on the user's real money.
 */

const SITE_URL = "https://gblin.digital";
const BASE_RPC = "https://mainnet.base.org";

const TOKENS = {
  cbBTC: { addr: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", dec: 8, kind: "btc" as const },
  weth: { addr: "0x4200000000000000000000000000000000000006", dec: 18, kind: "eth" as const },
  usdc: { addr: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", dec: 6, kind: "usdc" as const },
};

const C = {
  text: "#ffffff",
  textDim: "#94a3b8",
  textMute: "#64748b",
  border: "rgba(148,163,184,0.14)",
  amber: "#fbbf24",
  btc: "#f7931a",
  eth: "#7b7bff",
  emerald: "#10b981",
};

const glassCard: React.CSSProperties = {
  borderRadius: 22,
  background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
  border: `1px solid ${C.border}`,
  boxShadow: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 24px 60px -28px rgba(0,0,0,0.7)",
};

function padAddr(a: string): string {
  return a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

async function rpc(method: string, params: unknown[]): Promise<string> {
  const r = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  return (j?.result as string) || "0x0";
}

function toNumber(hex: string, dec: number): number {
  try {
    if (!hex || hex === "0x") return 0;
    return Number(BigInt(hex)) / 10 ** dec;
  } catch {
    return 0;
  }
}

async function spot(sym: string): Promise<number> {
  try {
    const r = await fetch(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`);
    const j = await r.json();
    return parseFloat(j?.data?.amount) || 0;
  } catch {
    return 0;
  }
}

function bumpStreak(): number {
  try {
    const wk = Math.floor(Date.now() / (7 * 86400000));
    const lastWk = parseInt(localStorage.getItem("gblin_streak_wk") || "0", 10);
    let streak = parseInt(localStorage.getItem("gblin_streak") || "0", 10);
    if (wk === lastWk) streak = Math.max(streak, 1);
    else if (wk === lastWk + 1) streak = streak + 1;
    else streak = 1;
    localStorage.setItem("gblin_streak_wk", String(wk));
    localStorage.setItem("gblin_streak", String(streak));
    return streak;
  } catch {
    return 0;
  }
}

type Result = {
  username: string | null;
  weights: ValueWeights;
  totalUsd: number;
  worst: ReturnType<typeof worstCrash>;
};

export default function PortfolioCheck() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "empty" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [shareState, setShareState] = useState<"idle" | "loading">("idle");
  const [streak, setStreak] = useState(0);

  async function getProvider(): Promise<{ provider: any; username: string | null }> {
    let username: string | null = null;
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      try {
        const ctx = await sdk.context;
        username = ctx?.user?.username ?? null;
      } catch {}
      const provider = await sdk.wallet.getEthereumProvider();
      if (provider) return { provider, username };
    } catch {}
    const inj = (typeof window !== "undefined" ? (window as any).ethereum : null) || null;
    return { provider: inj, username };
  }

  async function check() {
    setState("loading");
    try {
      const { provider, username } = await getProvider();
      if (!provider) {
        setState("error");
        return;
      }
      const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0];
      if (!addr) {
        setState("error");
        return;
      }

      const sel = "0x70a08231";
      const [cbBtcHex, wethHex, usdcHex, nativeHex, btcPrice, ethPrice] = await Promise.all([
        rpc("eth_call", [{ to: TOKENS.cbBTC.addr, data: sel + padAddr(addr) }, "latest"]),
        rpc("eth_call", [{ to: TOKENS.weth.addr, data: sel + padAddr(addr) }, "latest"]),
        rpc("eth_call", [{ to: TOKENS.usdc.addr, data: sel + padAddr(addr) }, "latest"]),
        rpc("eth_getBalance", [addr, "latest"]),
        spot("BTC"),
        spot("ETH"),
      ]);

      const btcUsd = toNumber(cbBtcHex, TOKENS.cbBTC.dec) * btcPrice;
      const ethUsd = (toNumber(wethHex, TOKENS.weth.dec) + toNumber(nativeHex, 18)) * ethPrice;
      const usdcUsd = toNumber(usdcHex, TOKENS.usdc.dec);
      const totalUsd = btcUsd + ethUsd + usdcUsd;

      if (totalUsd < 1) {
        setState("empty");
        setResult({ username, weights: { btc: 0, eth: 0, usdc: 1 }, totalUsd, worst: worstCrash({ btc: 0.5, eth: 0.5, usdc: 0 }) });
        return;
      }

      const weights: ValueWeights = {
        btc: btcUsd / totalUsd,
        eth: ethUsd / totalUsd,
        usdc: usdcUsd / totalUsd,
      };
      setStreak(bumpStreak());
      setResult({ username, weights, totalUsd, worst: worstCrash(weights) });
      setState("done");
    } catch {
      setState("error");
    }
  }

  async function onShare() {
    if (!result) return;
    setShareState("loading");
    const w = result.worst;
    const text =
      `I just stress-tested my wallet against real crypto crashes.\n\n` +
      `In ${w.crash.short}, my portfolio would have dropped -${w.portfolio}%. ` +
      `The GBLIN basket fell just -${w.gblin}% — it de-risks itself, on-chain.\n\n` +
      `Test yours 👇`;
    const embed = `${SITE_URL}/api/share?you=${w.portfolio}&gblin=${w.gblin}&crash=${w.crash.id}${result.username ? `&u=${encodeURIComponent(result.username)}` : ""}`;
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      await sdk.actions.composeCast({ text, embeds: [embed] });
    } catch {
      try {
        const intent = new URL("https://warpcast.com/~/compose");
        intent.searchParams.set("text", text);
        intent.searchParams.append("embeds[]", embed);
        window.open(intent.toString(), "_blank", "noopener,noreferrer");
      } catch {}
    }
    setShareState("idle");
  }

  const pct = (n: number) => Math.round(n * 100);

  return (
    <main className="gblin-mesh" style={{ minHeight: "100vh", color: C.text, padding: "20px 14px 32px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <section className="gblin-fade-up gblin-glass" style={{ ...glassCard, padding: "20px 16px 16px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png" alt="GBLIN" width={36} height={36} style={{ borderRadius: 9, objectFit: "contain" }} />
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                <span className="gblin-grad-text-amber">GBLIN</span> — Wallet stress test
              </div>
              <div style={{ fontSize: 10.5, color: C.textMute }}>your real holdings vs the Crash Shield</div>
            </div>
          </div>

          {state === "idle" && (
            <div className="gblin-fade-up">
              <h1 style={{ fontSize: 22, margin: "0 0 10px", fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.15 }}>
                How hard would <span className="gblin-grad-text-amber">your wallet</span> have crashed?
              </h1>
              <p style={{ color: C.textDim, fontSize: 13.5, lineHeight: 1.55, margin: "0 0 18px" }}>
                Connect your wallet. We read your BTC / ETH / stables on Base and show how far your portfolio would have fallen in the worst real crash — vs the GBLIN basket. Nothing is sent or moved.
              </p>
              <button onClick={check} style={btnGold}>
                <Wallet size={16} style={{ verticalAlign: -3, marginRight: 7 }} /> Connect &amp; stress-test
              </button>
            </div>
          )}

          {state === "loading" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <Loader2 className="gblin-spin" size={28} color={C.amber} />
              <div style={{ color: C.textDim, fontSize: 13, marginTop: 12 }}>Reading your holdings on Base…</div>
            </div>
          )}

          {state === "error" && (
            <div className="gblin-fade-up">
              <p style={{ color: C.textDim, fontSize: 13.5, lineHeight: 1.55 }}>
                Couldn&apos;t connect a wallet. Open this inside a Farcaster client or a wallet browser, then try again.
              </p>
              <button onClick={check} style={{ ...btnGhost, marginTop: 12 }}>Try again</button>
            </div>
          )}

          {(state === "done" || state === "empty") && result && (
            <div className="gblin-fade-up">
              {state === "empty" ? (
                <p style={{ color: C.textDim, fontSize: 13.5, lineHeight: 1.55, margin: "0 0 14px" }}>
                  No BTC, ETH or USDC found in this wallet on Base. Here&apos;s what a typical 50/50 BTC/ETH portfolio would have done:
                </p>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Your allocation</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 14, fontSize: 12 }}>
                    <Chip label="BTC" v={pct(result.weights.btc)} color={C.btc} />
                    <Chip label="ETH" v={pct(result.weights.eth)} color={C.eth} />
                    <Chip label="Stables" v={pct(result.weights.usdc)} color={C.emerald} />
                  </div>
                </>
              )}

              {streak > 1 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, border: "1px solid rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.1)", color: "#fde68a", fontSize: 11, fontWeight: 700, marginBottom: 12 }}>
                  🔥 {streak}-week streak
                </div>
              )}
              <div style={{ fontSize: 11, color: C.textMute, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
                Worst case · {result.worst.crash.label} ({result.worst.crash.when})
              </div>
              <Bar label="🩸 Your portfolio" value={result.worst.portfolio} max={Math.max(result.worst.portfolio, result.worst.gblin, 1)} color="#f87171" strong />
              <Bar label="🛡️ GBLIN basket" value={result.worst.gblin} max={Math.max(result.worst.portfolio, result.worst.gblin, 1)} color={C.amber} strong />

              <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.55, margin: "12px 0 14px" }}>
                In {result.worst.crash.short}, you&apos;d have fallen <b style={{ color: "#f87171" }}>−{result.worst.portfolio}%</b>. GBLIN fell <b style={{ color: C.amber }}>−{result.worst.gblin}%</b> — {result.worst.portfolio > result.worst.gblin ? `${Math.round(result.worst.portfolio - result.worst.gblin)} points less downside.` : "comparable downside."}
              </p>

              <button onClick={onShare} disabled={shareState === "loading"} style={btnGold}>
                <Share2 size={16} style={{ verticalAlign: -3, marginRight: 6 }} /> {shareState === "loading" ? "Opening…" : "Share my result"}
              </button>
              <Link href="/buy-gblin" style={{ textDecoration: "none" }}>
                <div style={{ ...btnGhost, marginTop: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Sparkles size={15} /> Mint GBLIN — de-risk for real
                </div>
              </Link>
            </div>
          )}

          <div style={{ height: 1, background: C.border, margin: "16px -4px 0" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontSize: 11, color: C.textMute, marginTop: 10 }}>
            <Link href="/frame" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.textMute, textDecoration: "none" }}>
              <Shield size={12} /> Crash Shield challenge
            </Link>
            <Link href="/game" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.textMute, textDecoration: "none" }}>
              Play <ArrowRight size={12} />
            </Link>
          </div>
        </section>
        <p style={{ textAlign: "center", fontSize: 10, color: C.textMute, marginTop: 12, lineHeight: 1.5 }}>
          Read-only. Drawdowns from the 10y backtest across {CRASHES.length} real crashes. Not financial advice.
        </p>
      </div>
    </main>
  );
}

function Chip({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 99, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)" }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: color }} />
      <b style={{ color: "#fff" }}>{v}%</b> <span style={{ color: C.textDim }}>{label}</span>
    </span>
  );
}

function Bar({ label, value, max, color, strong = false }: { label: string; value: number; max: number; color: string; strong?: boolean }) {
  return (
    <div style={{ margin: "11px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
        <span style={{ color: strong ? "#fff" : "#cbd5e1", fontWeight: strong ? 700 : 500 }}>{label}</span>
        <b style={{ color }}>−{value}%</b>
      </div>
      <div style={{ height: 13, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, borderRadius: 99, background: color, boxShadow: strong ? `0 0 14px -2px ${color}` : "none" }} />
      </div>
    </div>
  );
}

const btnGold: React.CSSProperties = {
  display: "block", width: "100%", border: "none", cursor: "pointer", borderRadius: 13,
  padding: 14, fontSize: 15, fontWeight: 800, background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#1a1405",
};
const btnGhost: React.CSSProperties = {
  display: "block", width: "100%", cursor: "pointer", borderRadius: 13, padding: 13, fontSize: 14, fontWeight: 700,
  background: "rgba(255,255,255,0.03)", color: "#cbd5e1", border: `1px solid ${C.border}`,
};
