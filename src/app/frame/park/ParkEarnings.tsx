"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Wallet } from "lucide-react";
import MiniBuy from "../MiniBuy";
import { SiteLink, detectMiniApp } from "../site-link";

/**
 * Park your earnings: the treasury plan, sized for a creator or trader holding what they earned.
 *
 * The visitor enters what they earned and what they want to keep liquid. The amount above that is
 * simulated by the same free endpoint the agents use (/api/x402/plan, `trial` = amount to park):
 * GBLIN received at net asset value, every fee read from the vault, and what the position would
 * return if it were sold the same day. Nothing is executed here; minting stays a separate, signed step.
 */

const C = {
  text: "#ffffff",
  textDim: "#94a3b8",
  textMute: "#64748b",
  border: "rgba(148,163,184,0.14)",
  emerald: "#10b981",
  amber: "#fbbf24",
};

const card: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
  border: `1px solid ${C.border}`,
};

// Any valid address works when no wallet is connected: the plan only reads its balances.
const PLACEHOLDER_WALLET = "0x0000000000000000000000000000000000000001";
const MIN_PARK_USD = 1;

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

type Simulation = {
  status: string;
  gblin_expected: string;
  position_value_usd: number;
  fees: { mint_fee_usd: number; management_fee_usd_per_year: number; protocol_fee_bps: number; stability_fee_bps: number; entry_swap_fee_bps: number };
  exit_today: { net_estimate_usd: number };
  round_trip_cost_usd: number;
  round_trip_cost_bps: number;
};

type Plan = {
  market: { nav_usd: number; eth_price_usd: number; regime: string; crash_shield_active: boolean };
  wallet_state: { usdc: string; eth: string };
  trial: Simulation;
};

function usd(n: number, digits = 2): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function getWallet(): Promise<Eip1193 | null> {
  if (await detectMiniApp()) {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    return ((await sdk.wallet.getEthereumProvider()) as Eip1193 | undefined) ?? null;
  }
  return (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null;
}

export default function ParkEarnings() {
  const [earned, setEarned] = useState("500");
  const [keep, setKeep] = useState("150");
  const [wallet, setWallet] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletNote, setWalletNote] = useState<string | null>(null);

  const earnedN = parseAmount(earned);
  const keepN = parseAmount(keep);
  const park = earnedN !== null && keepN !== null ? Math.max(0, earnedN - keepN) : null;

  const simulate = useCallback(async () => {
    if (park === null || park < MIN_PARK_USD) {
      setPlan(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        wallet: wallet ?? PLACEHOLDER_WALLET,
        reserve: String(keepN ?? 0),
        trial: park.toFixed(2),
      });
      const res = await fetch(`/api/x402/plan?${qs.toString()}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setPlan(body as Plan);
    } catch (e) {
      setPlan(null);
      setError(e instanceof Error ? e.message : "The simulation is not available right now.");
    } finally {
      setLoading(false);
    }
  }, [park, keepN, wallet]);

  // Recompute shortly after the visitor stops typing.
  useEffect(() => {
    const t = setTimeout(simulate, 500);
    return () => clearTimeout(t);
  }, [simulate]);

  const useMyWallet = async () => {
    setWalletNote(null);
    try {
      const provider = await getWallet();
      if (!provider) {
        setWalletNote("No wallet found. Enter the amounts by hand.");
        return;
      }
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts?.[0];
      if (!address) return;
      setWallet(address);
      const res = await fetch(`/api/x402/plan?wallet=${address}&reserve=0&trial=1`, { cache: "no-store" });
      const body = (await res.json()) as Plan;
      if (!res.ok) throw new Error();
      const total = Number(body.wallet_state.usdc) + Number(body.wallet_state.eth) * body.market.eth_price_usd;
      setEarned(total.toFixed(2));
      setWalletNote(`Read from ${address.slice(0, 6)}…${address.slice(-4)}: ${usd(Number(body.wallet_state.usdc))} USDC and ${Number(body.wallet_state.eth).toFixed(4)} ETH.`);
    } catch {
      setWalletNote("Could not read the wallet. Enter the amounts by hand.");
    }
  };

  const sim = plan?.trial;
  const ok = sim && sim.status === "ok";

  return (
    <main className="gblin-mesh" style={{ minHeight: "100vh", color: C.text, padding: "20px 14px 32px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <header>
          <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: C.amber, fontWeight: 800 }}>GBLIN · Park your earnings</div>
          <h1 style={{ fontSize: 22, margin: "6px 0 6px", letterSpacing: -0.6, fontWeight: 900, lineHeight: 1.15 }}>
            Keep what you spend liquid. See what the rest would do in BTC, ETH and USDC.
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>
            One token holding cbBTC, WETH and USDC, minted and redeemed at net asset value. The numbers below are read from the vault right now, including what it costs to get out today.
          </p>
        </header>

        <section style={card}>
          <label style={{ display: "block", fontSize: 12, color: C.textDim, marginBottom: 6 }}>What you earned (USD)</label>
          <input inputMode="decimal" value={earned} onChange={(e) => setEarned(e.target.value)} style={inputStyle} aria-label="What you earned in US dollars" />
          <label style={{ display: "block", fontSize: 12, color: C.textDim, margin: "12px 0 6px" }}>What you keep liquid (USD)</label>
          <input inputMode="decimal" value={keep} onChange={(e) => setKeep(e.target.value)} style={inputStyle} aria-label="What you keep liquid in US dollars" />
          <button onClick={useMyWallet} style={ghostButton}>
            <Wallet size={14} /> Use my wallet balance
          </button>
          {walletNote && <p style={{ margin: "8px 0 0", fontSize: 11.5, color: C.textMute }}>{walletNote}</p>}
        </section>

        <section style={card} aria-live="polite">
          <div style={{ fontSize: 12, color: C.textDim }}>Amount to park</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.8 }}>{park === null ? "—" : usd(park)}</div>
          {park !== null && park < MIN_PARK_USD && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: C.textDim }}>Nothing above what you keep liquid: nothing to park.</p>}
          {loading && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: C.textMute }}>Reading the vault…</p>}
          {error && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#fda4af" }}>{error}</p>}
          {ok && plan && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <Row label="GBLIN received at NAV" value={`${Number(sim.gblin_expected).toFixed(4)} GBLIN`} />
              <Row label="Position value" value={usd(sim.position_value_usd)} />
              <Row label="Mint fee (one time)" value={usd(sim.fees.mint_fee_usd)} />
              <Row label="Management fee" value={`${usd(sim.fees.management_fee_usd_per_year)} a year`} />
              <div style={{ height: 1, background: C.border, margin: "2px 0" }} />
              <Row label="If you sold it today" value={usd(sim.exit_today.net_estimate_usd)} strong />
              <Row label="Round trip cost today" value={`${usd(sim.round_trip_cost_usd)} (${(sim.round_trip_cost_bps / 100).toFixed(2)}%)`} />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: C.textMute, lineHeight: 1.5 }}>
                NAV {usd(plan.market.nav_usd)} · market regime {plan.market.regime}
                {plan.market.crash_shield_active ? " · crash shield active" : ""}. Simulated from USDC; minting with ETH skips the USDC to ETH swap.
                The exit estimate does not include price impact.
              </p>
            </div>
          )}
        </section>

        {ok && (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: C.textDim }}>Mint with ETH from this wallet, any amount you choose. Your wallet asks you to confirm.</div>
            <MiniBuy />
            <SiteLink path="/treasury" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#fde68a", fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}>
              Full plan with USDC and daily spend <ArrowRight size={14} />
            </SiteLink>
          </section>
        )}

        <p style={{ margin: "4px 0 0", fontSize: 10.5, color: C.textMute, lineHeight: 1.5 }}>
          Not financial advice. GBLIN is crypto exposure with a rule that cuts risk-asset weights in drawdowns: it is volatile, not a stablecoin, and not capital protection. Keep in stablecoins what you need to spend.
        </p>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.25)",
  background: "rgba(10,11,20,0.6)",
  color: "#fff",
  fontSize: 18,
  fontWeight: 700,
  outline: "none",
};

const ghostButton: React.CSSProperties = {
  marginTop: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "9px 12px",
  borderRadius: 11,
  border: "1px solid rgba(148,163,184,0.25)",
  background: "rgba(255,255,255,0.03)",
  color: "#cbd5e1",
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
};

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 12.5, color: "#94a3b8" }}>{label}</span>
      <span style={{ fontSize: strong ? 16 : 13.5, fontWeight: strong ? 900 : 700, color: strong ? "#10b981" : "#fff" }}>{value}</span>
    </div>
  );
}
