"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPublicClient, encodeFunctionData, formatUnits, http, parseAbi, type Hex } from "viem";
import { base } from "viem/chains";
import { CONTRACT_ADDRESS, LENS_ADDRESS, RPC_URL } from "@/components/protocol/protocol-data";
import { withBuilderSuffix } from "@/lib/builder-code";

/**
 * One-tap mint inside the Farcaster / Base App mini app.
 *
 * The wallet is the one the host app already provides (sdk.wallet.getEthereumProvider), so a
 * visitor who has ETH on Base can buy without leaving the feed, connecting anything or switching
 * app. The call is the same one the website makes: `buyGBLIN(minOut)` on the vault, priced at net
 * asset value by the Lens, with a 1% floor on the shares received and the Base builder code
 * appended for attribution. Outside a mini app the component links to the full buy page instead.
 */

const ETH_USD_FEED = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
const AMOUNTS_USD = [5, 10, 25];
const SLIPPAGE_BPS = 100n;

const FEED_ABI = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"]);
const LENS_ABI = parseAbi(["function quoteBuy(address vault, uint256 ethValue) view returns (uint256 out, uint256 protocolFee, uint256 stabilityFee)"]);
const VAULT_ABI = parseAbi(["function buyGBLIN(uint256 minOut) payable"]);

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

type Status =
  | { kind: "idle" }
  | { kind: "busy"; note: string }
  | { kind: "done"; hash: string; shares: string }
  | { kind: "error"; note: string };

export default function MiniBuy() {
  const [inMiniApp, setInMiniApp] = useState<boolean | null>(null);
  const [ethUsd, setEthUsd] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const inside = await sdk.isInMiniApp();
        if (!cancelled) setInMiniApp(inside);
      } catch {
        if (!cancelled) setInMiniApp(false);
      }
      try {
        const [, answer] = await client.readContract({ address: ETH_USD_FEED, abi: FEED_ABI, functionName: "latestRoundData" });
        if (!cancelled && answer > 0n) setEthUsd(Number(answer) / 1e8);
      } catch {
        /* the buttons stay disabled without a price */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buy = async (usd: number) => {
    if (!ethUsd) return;
    setStatus({ kind: "busy", note: "Opening your wallet…" });
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      const provider = (await sdk.wallet.getEthereumProvider()) as Eip1193 | undefined;
      if (!provider) throw new Error("This app did not provide a wallet.");

      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const from = accounts?.[0];
      if (!from) throw new Error("No account selected.");
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] });
      } catch {
        /* most hosts are already on Base; the transaction itself names the chain */
      }

      const value = BigInt(Math.floor((usd / ethUsd) * 1e18));
      const [out] = await client.readContract({ address: LENS_ADDRESS as Hex, abi: LENS_ABI, functionName: "quoteBuy", args: [CONTRACT_ADDRESS as Hex, value] });
      if (out === 0n) throw new Error("The vault is not quoting right now. Try again in a minute.");
      const minOut = (out * (10000n - SLIPPAGE_BPS)) / 10000n;
      const data = withBuilderSuffix(encodeFunctionData({ abi: VAULT_ABI, functionName: "buyGBLIN", args: [minOut] }));

      // Same margin the website uses: the estimate plus 25%, so a wallet that estimates on a stale
      // block does not send a limit that falls short. If the estimate fails, the wallet estimates.
      let gas: string | undefined;
      try {
        const est = await client.estimateGas({ account: from as Hex, to: CONTRACT_ADDRESS as Hex, data, value });
        gas = `0x${((est * 5n) / 4n).toString(16)}`;
      } catch {
        gas = undefined;
      }

      setStatus({ kind: "busy", note: "Confirm in your wallet…" });
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from, to: CONTRACT_ADDRESS, value: `0x${value.toString(16)}`, data, chainId: "0x2105", ...(gas ? { gas } : {}) }],
      })) as string;
      setStatus({ kind: "done", hash, shares: Number(formatUnits(out, 18)).toPrecision(3) });
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fde68a" }}>Hold the basket — mint at net asset value</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {AMOUNTS_USD.map((usd) => (
          <button
            key={usd}
            onClick={() => buy(usd)}
            disabled={busy || !ethUsd || inMiniApp === null}
            style={{ ...chip, opacity: busy || !ethUsd ? 0.55 : 1 }}
          >
            ${usd}
          </button>
        ))}
      </div>
      {status.kind === "busy" && <p style={note}>{status.note}</p>}
      {status.kind === "error" && <p style={{ ...note, color: "#fda4af" }}>{status.note}</p>}
      {status.kind === "done" && (
        <p style={{ ...note, color: "#a7f3d0" }}>
          Sent: about {status.shares} GBLIN on the way.{" "}
          <a href={`https://basescan.org/tx/${status.hash}`} target="_blank" rel="noreferrer" style={{ color: "#fde68a" }}>
            View on Basescan
          </a>
        </p>
      )}
      <p style={{ ...note, fontSize: 10.5 }}>
        Paid in ETH on Base, 0.10% mint fee, redeemable from the contract at any time. GBLIN is volatile, not a
        stablecoin. <Link href="/about" style={{ color: "#94a3b8" }}>Who is behind it</Link>
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
const note: React.CSSProperties = { margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 };
