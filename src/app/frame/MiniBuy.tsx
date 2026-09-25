"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPublicClient, encodeFunctionData, formatUnits, http, parseAbi, parseUnits, type Hex } from "viem";
import { base } from "viem/chains";
import { CONTRACT_ADDRESS, LENS_ADDRESS, RPC_URL } from "@/components/protocol/protocol-data";
import { withBuilderSuffix } from "@/lib/builder-code";
import { SiteLink } from "./site-link";

/**
 * Mint inside the Farcaster / Base App mini app.
 *
 * The wallet is the one the host app already provides (sdk.wallet.getEthereumProvider), so a
 * visitor who has ETH on Base can buy without leaving the feed, connecting anything or switching
 * app. Two ways to buy: one tap on a fixed amount, or an amount the buyer types in dollars or ETH,
 * quoted by the Lens while it is typed. The call is the same one the website makes:
 * `buyGBLIN(minOut)` on the vault, priced at net asset value, with a 1% floor on the shares
 * received and the Base builder code appended for attribution. Outside a mini app the component
 * links to the full buy page instead.
 */

const ETH_USD_FEED = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
const AMOUNTS_USD = [5, 10, 25];
const SLIPPAGE_BPS = 100n;
// ETH that "Max" leaves in the wallet to pay the gas of the mint itself (about $0.25).
const GAS_RESERVE_WEI = 100_000_000_000_000n;

const FEED_ABI = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"]);
const LENS_ABI = parseAbi(["function quoteBuy(address vault, uint256 ethValue) view returns (uint256 out, uint256 protocolFee, uint256 stabilityFee)"]);
const VAULT_ABI = parseAbi([
  "function buyGBLIN(uint256 minOut) payable",
  "function navPerShare(uint256 excludeWeth) view returns (uint256)",
]);

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
type Unit = "USD" | "ETH";

type Status =
  | { kind: "idle" }
  | { kind: "busy"; note: string }
  | { kind: "done"; hash: string; shares: string }
  | { kind: "error"; note: string };

/** Dollars to wei of ETH at the feed price (8 decimals). */
function usdToWei(usd: string, ethUsd: bigint): bigint {
  return (parseUnits(usd, 8) * 10n ** 18n) / ethUsd;
}

/** Amount typed by the buyer, in wei of ETH. Accepts a comma as decimal separator. */
function toWei(raw: string, unit: Unit, ethUsd: bigint | null): bigint | null {
  const s = raw.trim().replace(",", ".");
  if (s === "" || s === "." || !/^\d*\.?\d*$/.test(s)) return null;
  try {
    if (unit === "ETH") return parseUnits(s, 18);
    if (!ethUsd || ethUsd <= 0n) return null;
    return usdToWei(s, ethUsd);
  } catch {
    return null;
  }
}

function fmtEth(wei: bigint): string {
  const n = Number(formatUnits(wei, 18));
  if (n === 0) return "0";
  return n >= 1 ? n.toFixed(4) : Number(n.toPrecision(3)).toString();
}

function fmtUsd(wei: bigint, ethUsd: bigint): string {
  const usd = Number((wei * ethUsd) / 10n ** 18n) / 1e8;
  return usd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtShares(shares: bigint): string {
  const n = Number(formatUnits(shares, 18));
  return n >= 1 ? n.toFixed(3) : Number(n.toPrecision(3)).toString();
}

/** Rounds a wei amount down to 6 decimals of ETH, written without trailing zeros. */
function ethInput(wei: bigint): string {
  const floored = (wei / 1_000_000_000_000n) * 1_000_000_000_000n;
  return formatUnits(floored, 18);
}

export default function MiniBuy() {
  const [inMiniApp, setInMiniApp] = useState<boolean | null>(null);
  const [ethUsd, setEthUsd] = useState<bigint | null>(null);
  const [navEth, setNavEth] = useState<bigint | null>(null);
  const [unit, setUnit] = useState<Unit>("USD");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<{ value: bigint; out: bigint } | null>(null);
  const [quoteFailed, setQuoteFailed] = useState<bigint | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const refreshBalance = useCallback(async (addr: Hex) => {
    try {
      setBalance(await client.getBalance({ address: addr }));
    } catch {
      /* the balance is simply not shown */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let inside = false;
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        inside = await sdk.isInMiniApp();
        if (!cancelled) setInMiniApp(inside);
        if (inside) {
          // The host wallet is usually connected already: eth_accounts reads it without a prompt.
          const provider = (await sdk.wallet.getEthereumProvider()) as Eip1193 | undefined;
          const accounts = (await provider?.request({ method: "eth_accounts" })) as string[] | undefined;
          const first = accounts?.[0] as Hex | undefined;
          if (first && !cancelled) void refreshBalance(first);
        }
      } catch {
        if (!cancelled) setInMiniApp(inside);
      }
    })();
    (async () => {
      try {
        const [, answer] = await client.readContract({ address: ETH_USD_FEED, abi: FEED_ABI, functionName: "latestRoundData" });
        if (!cancelled && answer > 0n) setEthUsd(answer);
      } catch {
        /* the dollar buttons stay disabled without a price; ETH amounts still work */
      }
    })();
    (async () => {
      try {
        const nav = await client.readContract({ address: CONTRACT_ADDRESS as Hex, abi: VAULT_ABI, functionName: "navPerShare", args: [0n] });
        if (!cancelled && nav > 0n) setNavEth(nav);
      } catch {
        /* the price is simply not shown */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshBalance]);

  const value = useMemo(() => toWei(amount, unit, ethUsd), [amount, unit, ethUsd]);

  // Quote the shares for the typed amount, a moment after the last keystroke.
  useEffect(() => {
    if (!value || value === 0n) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const [out] = await client.readContract({ address: LENS_ADDRESS as Hex, abi: LENS_ABI, functionName: "quoteBuy", args: [CONTRACT_ADDRESS as Hex, value] });
        if (!cancelled) setQuote({ value, out });
      } catch {
        if (!cancelled) setQuoteFailed(value);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  const buy = async (wei: bigint) => {
    if (wei === 0n) return;
    setStatus({ kind: "busy", note: "Opening your wallet…" });
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      const provider = (await sdk.wallet.getEthereumProvider()) as Eip1193 | undefined;
      if (!provider) throw new Error("This app did not provide a wallet.");

      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const from = accounts?.[0] as Hex | undefined;
      if (!from) throw new Error("No account selected.");
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] });
      } catch {
        /* most hosts are already on Base; the transaction itself names the chain */
      }

      const [out] = await client.readContract({ address: LENS_ADDRESS as Hex, abi: LENS_ABI, functionName: "quoteBuy", args: [CONTRACT_ADDRESS as Hex, wei] });
      if (out === 0n) throw new Error("The vault is not quoting right now. Try again in a minute.");
      const minOut = (out * (10000n - SLIPPAGE_BPS)) / 10000n;
      const data = withBuilderSuffix(encodeFunctionData({ abi: VAULT_ABI, functionName: "buyGBLIN", args: [minOut] }));

      // Same margin the website uses: the estimate plus 25%, so a wallet that estimates on a stale
      // block does not send a limit that falls short. If the estimate fails, the wallet estimates.
      let gas: string | undefined;
      try {
        const est = await client.estimateGas({ account: from, to: CONTRACT_ADDRESS as Hex, data, value: wei });
        gas = `0x${((est * 5n) / 4n).toString(16)}`;
      } catch {
        gas = undefined;
      }

      setStatus({ kind: "busy", note: "Confirm in your wallet…" });
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from, to: CONTRACT_ADDRESS, value: `0x${wei.toString(16)}`, data, chainId: "0x2105", ...(gas ? { gas } : {}) }],
      })) as string;
      setStatus({ kind: "done", hash, shares: fmtShares(out) });
      setTimeout(() => void refreshBalance(from), 6000);
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      if (/reject|denied|4001/i.test(msg)) setStatus({ kind: "idle" });
      else if (/insufficient funds/i.test(msg)) setStatus({ kind: "error", note: "Not enough ETH on Base for this amount plus gas." });
      else setStatus({ kind: "error", note: msg.split("\n")[0].slice(0, 140) });
    }
  };

  if (inMiniApp === false) {
    return (
      <Link href="/buy-gblin" style={{ textDecoration: "none" }}>
        <div style={box}>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: "#1a1405" }}>Buy GBLIN at net asset value →</div>
        </div>
      </Link>
    );
  }

  const busy = status.kind === "busy";
  const shown = quote && value !== null && quote.value === value ? quote : null;
  const quoting = value !== null && value > 0n && !shown && quoteFailed !== value;
  const overBalance = value !== null && balance !== null && value > balance;
  const canBuyCustom = !busy && inMiniApp === true && value !== null && value > 0n && !!shown && shown.out > 0n && !overBalance;
  const navUsd = navEth && ethUsd ? fmtUsd(navEth, ethUsd) : null;

  const switchUnit = () => {
    const next: Unit = unit === "USD" ? "ETH" : "USD";
    if (next === "USD" && !ethUsd) return; // no price to convert with
    if (value !== null && value > 0n && ethUsd) {
      setAmount(next === "ETH" ? ethInput(value) : (Number((value * ethUsd) / 10n ** 18n) / 1e8).toFixed(2));
    }
    setUnit(next);
  };

  let summary: string | null = null;
  if (value !== null && value > 0n) {
    if (quoting) summary = "Quoting at net asset value…";
    else if (!shown) summary = "No quote right now. Try again in a minute.";
    else {
      const other = unit === "USD" ? `${fmtEth(value)} ETH` : ethUsd ? fmtUsd(value, ethUsd) : `${fmtEth(value)} ETH`;
      summary = `≈ ${other} → about ${fmtShares(shown.out)} GBLIN`;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fde68a" }}>Hold the basket — mint at net asset value</div>
        {navUsd && <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>1 GBLIN = {navUsd}</div>}
      </div>

      {/* One tap: buys the amount right away */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {AMOUNTS_USD.map((usd) => (
          <button
            key={usd}
            onClick={() => ethUsd && buy(usdToWei(String(usd), ethUsd))}
            disabled={busy || !ethUsd || inMiniApp === null}
            style={{ ...chip, opacity: busy || !ethUsd ? 0.55 : 1 }}
          >
            ${usd}
          </button>
        ))}
      </div>

      {/* Or the buyer's own amount */}
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>Or choose your amount</div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={inputRow}>
          <span style={{ color: "#94a3b8", fontWeight: 800, fontSize: 16, width: 14, textAlign: "center" }}>{unit === "USD" ? "$" : "Ξ"}</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            aria-label={unit === "USD" ? "Amount in US dollars" : "Amount in ETH"}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (!busy) setStatus({ kind: "idle" });
            }}
            placeholder={unit === "USD" ? "e.g. 40" : "e.g. 0.02"}
            style={inputStyle}
          />
          <button onClick={switchUnit} disabled={busy} style={unitBtn} aria-label="Switch between dollars and ETH">
            {unit} ⇄
          </button>
        </div>
        <button
          onClick={() => value && buy(value)}
          disabled={!canBuyCustom}
          style={{ ...chip, padding: "0 16px", opacity: canBuyCustom ? 1 : 0.5, cursor: canBuyCustom ? "pointer" : "default" }}
        >
          Buy
        </button>
      </div>
      {(summary || balance !== null) && (
        <p style={note}>
          {summary}
          {summary && balance !== null ? " · " : ""}
          {balance !== null && (
            <>
              Wallet {fmtEth(balance)} ETH
              {overBalance ? ", not enough" : ""}
              {balance > GAS_RESERVE_WEI && (
                <>
                  {" · "}
                  <button
                    onClick={() => {
                      setUnit("ETH");
                      setAmount(ethInput(balance - GAS_RESERVE_WEI));
                    }}
                    disabled={busy}
                    style={maxLink}
                  >
                    Max
                  </button>
                </>
              )}
            </>
          )}
        </p>
      )}

      {status.kind === "busy" && <p style={note}>{status.note}</p>}
      {status.kind === "error" && <p style={{ ...note, color: "#fda4af" }}>{status.note}</p>}
      {status.kind === "done" && (
        <p style={{ ...note, color: "#a7f3d0" }}>
          Sent: about {status.shares} GBLIN on the way.{" "}
          <SiteLink path={`https://basescan.org/tx/${status.hash}`} style={{ color: "#fde68a" }}>
            View on Basescan
          </SiteLink>
        </p>
      )}
      <p style={{ ...note, fontSize: 10.5 }}>
        Paid in ETH on Base, 0.10% mint fee, redeemable from the contract at any time. GBLIN is volatile, not a
        stablecoin.{" "}
        <SiteLink path="/about" style={{ color: "#94a3b8" }}>
          Who is behind it
        </SiteLink>
        {" · "}
        <SiteLink path="/buy-gblin" style={{ color: "#94a3b8" }}>
          Pay with other tokens on gblin.digital
        </SiteLink>
      </p>
    </div>
  );
}

const box: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: 13,
  borderRadius: 13,
  background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
};
const chip: React.CSSProperties = {
  padding: "13px 6px",
  borderRadius: 13,
  border: "none",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 15,
  background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
  color: "#1a1405",
};
const inputRow: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 4px 4px 10px",
  borderRadius: 13,
  border: "1px solid rgba(251,191,36,0.35)",
  background: "rgba(0,0,0,0.35)",
};
const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#ffffff",
  fontSize: 17,
  fontWeight: 800,
  padding: "8px 0",
  fontVariantNumeric: "tabular-nums",
};
const unitBtn: React.CSSProperties = {
  padding: "8px 9px",
  borderRadius: 9,
  border: "1px solid rgba(251,191,36,0.4)",
  background: "rgba(251,191,36,0.12)",
  color: "#fde68a",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const maxLink: React.CSSProperties = {
  border: "none",
  background: "none",
  padding: 0,
  color: "#fde68a",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  textDecoration: "underline",
};
const note: React.CSSProperties = { margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 };
