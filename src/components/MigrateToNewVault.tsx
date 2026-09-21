"use client";

/**
 * "Migrate" — moves a holder from the previous GBLIN contracts to the vault in service, in as few clicks as the wallet allows.
 *
 * How it works, per previous contract the wallet holds (newest first):
 *   1. Pre-flight, nothing signed yet: the new vault must be accepting deposits (NAV reliable, sentinel not paused, a
 *      1-gwei buy simulates), the sell must simulate, and the old contract's cooldown must be over.
 *   2a. Wallets that support atomic batches (EIP-5792: Base Account / Coinbase Smart Wallet, MetaMask smart accounts):
 *       ONE confirmation. Sell for ETH with a minimum, then buy the new vault with exactly that minimum. If the sale
 *       returns less, the buy has no ETH and the whole batch reverts: nothing half-done. The ETH above the minimum stays
 *       in the wallet.
 *   2b. Every other wallet: two transactions. The ETH actually received is read from the WETH Withdrawal event of the
 *       old contract (fallback: balance delta + gas), and that amount (minus a tiny gas reserve) buys the new vault.
 *       If the second step is rejected or fails, the component remembers it and offers "Finish migration".
 * Minimums are always set (the previous button used 0): the old contract's sell swaps each leg and, on the latest
 * previous contract, a failed leg is silently skipped; a minimum turns that into a revert instead of a loss.
 */

import { useCallback, useEffect, useState } from "react";
import { WagmiProvider, useAccount } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getBalance,
  getCapabilities,
  readContract,
  sendCalls,
  simulateContract,
  switchChain,
  waitForCallsStatus,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import { base } from "wagmi/chains";
import { decodeEventLog, encodeFunctionData, formatEther, parseAbi, type Address, type TransactionReceipt } from "viem";
import { wagmiConfig } from "@/lib/wagmi";
import { BUILDER_CODE_SUFFIX } from "@/lib/builder-code";

// ── addresses (Base) ──
export const NEW_VAULT: Address = "0xc2181d975c05c8c724b334bcED0764c0b86B1D53";
export const NEW_LENS: Address = "0xfCFea8027019E8551A1f09AD91532471F5D26f61";
export const NEW_SENTINEL: Address = "0x9F13C5c46a864183e1c57Ec02837fe5B980D3F67";
const WETH: Address = "0x4200000000000000000000000000000000000006";

type Source = { key: string; label: string; address: Address; fixedCooldown?: bigint };
// Order matters: the most recent previous contract first.
const SOURCES: Source[] = [
  { key: "prev", label: "previous GBLIN contract", address: "0x36C81d7E1966310F305eA637e761Cf77F90852f0" },
  { key: "old", label: "older GBLIN contract", address: "0x38DcDB3A381677239BBc652aed9811F2f8496345", fixedCooldown: 120n },
];

const SELL_SLIPPAGE_BPS = 200n;   // minimum ETH out = NAV quote − 2%
const BUY_SLIPPAGE_BPS = 100n;    // minimum shares out = Lens quote − 1%
const GAS_RESERVE = 30_000_000_000_000n; // 0.00003 ETH kept for the second transaction on Base
const PROBE_WEI = 1_000_000_000n; // 1 gwei: enough to prove the new vault accepts a deposit
// Below this the old contract cannot sell the legs for ETH (a few satoshi of cbBTC: Uniswap rounds the fee up and the
// sale reverts). Such positions are offered the in-kind exit instead.
const DUST_WEI = 500_000_000_000_000n; // 0.0005 ETH

const LEGACY_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function quoteSellGBLIN(uint256 gblinAmount) view returns (uint256 ethOut)",
  "function lastDepositTime(address) view returns (uint256)",
  "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)",
  "function sellGBLIN(uint256 gblinAmount)",
]);
const LEGACY_COOLDOWN_ABI = parseAbi(["function sellCooldown() view returns (uint256)"]);
const VAULT_ABI = parseAbi([
  "function buyGBLIN(uint256 minOut) payable",
  "function isNavReliable() view returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);
const LENS_ABI = parseAbi(["function quoteBuy(address v, uint256 ethValue) view returns (uint256 out, uint256 fFee, uint256 sFee)"]);
const SENTINEL_ABI = parseAbi(["function isPaused() view returns (bool)"]);
const WETH_EVENTS = parseAbi(["event Withdrawal(address indexed src, uint256 wad)"]);

const KNOWN_ERRORS: Record<string, string> = {
  CooldownActive: "You bought recently on the previous contract: wait a couple of minutes and retry.",
  SequencerDown: "Base's sequencer (or the vault's safety pause) is down: nothing was sold, retry later.",
  OracleDead: "A price feed is stale right now: nothing was sold, retry in a few minutes.",
  SlippageExceeded: "The price moved more than allowed: nothing was sold, retry.",
  PriceOffTwap: "The pool price is moving fast: nothing was sold, retry in a few minutes.",
};

const pendingKey = (a: Address) => `gblin:migrate:pending:${a.toLowerCase()}`;
function readPending(a: Address): bigint | null {
  try { const v = localStorage.getItem(pendingKey(a)); return v ? BigInt(v) : null; } catch { return null; }
}
function writePending(a: Address, wei: bigint | null) {
  try { if (wei === null) localStorage.removeItem(pendingKey(a)); else localStorage.setItem(pendingKey(a), wei.toString()); } catch { /* per-viewer convenience only */ }
}
function explain(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|user denied|4001/i.test(msg)) return null;
  for (const [name, text] of Object.entries(KNOWN_ERRORS)) if (msg.includes(name)) return text;
  return msg.split("\n")[0];
}

/** ETH the old contract sent: its WETH Withdrawal in the receipt (exact), else balance delta + fees paid. */
function ethSentBy(receipt: TransactionReceipt, source: Address): bigint | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== WETH.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: WETH_EVENTS, data: log.data, topics: log.topics });
      if (ev.eventName === "Withdrawal" && ev.args.src.toLowerCase() === source.toLowerCase()) return ev.args.wad;
    } catch { /* not a Withdrawal */ }
  }
  return null;
}

type Holding = { source: Source; balance: bigint; quoteEth: bigint };

function MigrateBanner() {
  const { address } = useAccount();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [pending, setPending] = useState<bigint | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  /** True when every previous contract failed to answer: that is not the same as holding nothing. */
  const [unreadable, setUnreadable] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) { setHoldings([]); setPending(null); setUnreadable(false); return; }
    const found: Holding[] = [];
    let failed = 0;
    for (const s of SOURCES) {
      try {
        const balance = await readContract(wagmiConfig, { address: s.address, abi: LEGACY_ABI, functionName: "balanceOf", args: [address], chainId: base.id });
        if (balance === 0n) continue;
        const quoteEth = await readContract(wagmiConfig, { address: s.address, abi: LEGACY_ABI, functionName: "quoteSellGBLIN", args: [balance], chainId: base.id });
        found.push({ source: s, balance, quoteEth });
      } catch { failed += 1; }
    }
    setHoldings(found);
    setPending(readPending(address));
    // An empty list because nothing could be read would silently claim "nothing to migrate".
    setUnreadable(found.length === 0 && failed === SOURCES.length);
  }, [address]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function ensureBase() {
    try { await switchChain(wagmiConfig, { chainId: base.id }); } catch { /* already on Base */ }
  }

  /** The new vault must accept a deposit before anything is sold. */
  async function newVaultOpen(account: Address): Promise<string | null> {
    const reliable = await readContract(wagmiConfig, { address: NEW_VAULT, abi: VAULT_ABI, functionName: "isNavReliable", chainId: base.id });
    if (!reliable) return "The new vault's prices are refreshing: nothing was sold, retry in a few minutes.";
    const paused = await readContract(wagmiConfig, { address: NEW_SENTINEL, abi: SENTINEL_ABI, functionName: "isPaused", chainId: base.id });
    if (paused) return "Deposits on the new vault are paused for safety: nothing was sold, retry later.";
    try {
      await simulateContract(wagmiConfig, { address: NEW_VAULT, abi: VAULT_ABI, functionName: "buyGBLIN", args: [0n], value: PROBE_WEI, account, chainId: base.id });
    } catch (e) { return explain(e) ?? "The new vault refused a test deposit: nothing was sold."; }
    return null;
  }

  async function cooldownLeft(s: Source, account: Address): Promise<bigint> {
    const last = await readContract(wagmiConfig, { address: s.address, abi: LEGACY_ABI, functionName: "lastDepositTime", args: [account], chainId: base.id });
    const cd = s.fixedCooldown ?? await readContract(wagmiConfig, { address: s.address, abi: LEGACY_COOLDOWN_ABI, functionName: "sellCooldown", chainId: base.id });
    const now = BigInt(Math.floor(Date.now() / 1000));
    return last + cd > now ? last + cd - now : 0n;
  }

  async function minSharesFor(ethIn: bigint): Promise<bigint> {
    const [out] = await readContract(wagmiConfig, { address: NEW_LENS, abi: LENS_ABI, functionName: "quoteBuy", args: [NEW_VAULT, ethIn], chainId: base.id });
    return out - (out * BUY_SLIPPAGE_BPS) / 10_000n;
  }

  async function buyNew(account: Address, ethIn: bigint) {
    const minOut = await minSharesFor(ethIn);
    const hash = await writeContract(wagmiConfig, {
      address: NEW_VAULT, abi: VAULT_ABI, functionName: "buyGBLIN", args: [minOut], value: ethIn,
      chainId: base.id, dataSuffix: BUILDER_CODE_SUFFIX,
    });
    const r = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: base.id });
    if (r.status !== "success") throw new Error("The purchase on the new vault reverted.");
  }

  async function supportsAtomicBatch(account: Address): Promise<boolean> {
    try {
      const caps = await getCapabilities(wagmiConfig, { account, chainId: base.id });
      const atomic = (caps as { atomic?: { status?: string } })?.atomic?.status;
      return atomic === "supported" || atomic === "ready";
    } catch { return false; }
  }

  async function migrateOne(h: Holding, account: Address) {
    const s = h.source;
    const wait = await cooldownLeft(s, account);
    if (wait > 0n) throw new Error(`Cooldown on the ${s.label}: retry in ${wait.toString()} s.`);
    // re-read at the last moment
    const balance = await readContract(wagmiConfig, { address: s.address, abi: LEGACY_ABI, functionName: "balanceOf", args: [account], chainId: base.id });
    if (balance === 0n) return;
    const quote = await readContract(wagmiConfig, { address: s.address, abi: LEGACY_ABI, functionName: "quoteSellGBLIN", args: [balance], chainId: base.id });
    const minEthOut = quote - (quote * SELL_SLIPPAGE_BPS) / 10_000n;
    await simulateContract(wagmiConfig, { address: s.address, abi: LEGACY_ABI, functionName: "sellGBLINForEth", args: [balance, minEthOut], account, chainId: base.id });

    // One confirmation is only offered when the account can already cover the deposit on its
    // own. Inside an atomic batch the sale funds the deposit, so on chain the order is sound --
    // but wallets price each call against the balance held BEFORE the batch, and a deposit
    // larger than that balance makes the arithmetic go negative: the wallet then reports that
    // there is not even enough ETH for the network fee and refuses the whole request.
    //
    // The two-step path has no such problem: the sale lands first, and the deposit is priced
    // against a balance that already holds the proceeds.
    const ethHeld = (await getBalance(wagmiConfig, { address: account, chainId: base.id })).value;
    const canPrefund = ethHeld >= minEthOut;
    if (canPrefund && (await supportsAtomicBatch(account))) {
      try {
        setStatus(`Migrating from the ${s.label} in one confirmation…`);
        const minOut = await minSharesFor(minEthOut);
        const { id } = await sendCalls(wagmiConfig, {
          account, chainId: base.id, forceAtomic: true,
          calls: [
            { to: s.address, data: (encodeFunctionData({ abi: LEGACY_ABI, functionName: "sellGBLINForEth", args: [balance, minEthOut] }) + BUILDER_CODE_SUFFIX.slice(2)) as `0x${string}` },
            { to: NEW_VAULT, value: minEthOut, data: (encodeFunctionData({ abi: VAULT_ABI, functionName: "buyGBLIN", args: [minOut] }) + BUILDER_CODE_SUFFIX.slice(2)) as `0x${string}` },
          ],
        });
        const res = await waitForCallsStatus(wagmiConfig, { id });
        if (res.status !== "success") throw new Error("batch not successful");
        return;
      } catch (e) {
        // A refusal in the wallet is a decision, not a fault: it is not retried another way.
        if (explain(e) === null) throw e;
        // Nothing moved: the batch is atomic, so falling back cannot sell twice.
        setStatus("The wallet refused the single confirmation. Falling back to two confirmations…");
      }
    }

    setStatus(`1/2 Selling on the ${s.label}: confirm in the wallet…`);
    const before = ethHeld;
    const sellHash = await writeContract(wagmiConfig, {
      address: s.address, abi: LEGACY_ABI, functionName: "sellGBLINForEth", args: [balance, minEthOut],
      chainId: base.id, dataSuffix: BUILDER_CODE_SUFFIX,
    });
    const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: sellHash, chainId: base.id });
    if (receipt.status !== "success") throw new Error("The sale reverted; nothing moved.");
    let received = ethSentBy(receipt, s.address);
    if (received === null) {
      const after = (await getBalance(wagmiConfig, { address: account, chainId: base.id })).value;
      const fees = receipt.gasUsed * receipt.effectiveGasPrice + ((receipt as unknown as { l1Fee?: bigint }).l1Fee ?? 0n);
      received = after + fees > before ? after + fees - before : 0n;
    }
    const ethIn = received > GAS_RESERVE ? received - GAS_RESERVE : 0n;
    if (ethIn === 0n) throw new Error("The ETH received is too small to buy on the new vault.");
    writePending(account, ethIn);
    setPending(ethIn);

    setStatus("2/2 Buying the new vault…");
    await buyNew(account, ethIn);
    writePending(account, null);
    setPending(null);
  }

  async function migrateAll() {
    if (!address) return;
    setBusy(true);
    setStatus("Checking the vault in service…");
    try {
      await ensureBase();
      const closed = await newVaultOpen(address);
      if (closed) { setStatus(closed); return; }
      for (const h of holdings) if (h.quoteEth >= DUST_WEI) await migrateOne(h, address);
      setStatus("✅ Migration complete.");
      await refresh();
    } catch (e) {
      setStatus(explain(e) ?? "Cancelled in the wallet. Nothing was sold.");
      await refresh();
    } finally { setBusy(false); }
  }

  /** Dust: redeem in kind on the old contract (no swaps, no price), the holder receives the underlying tokens. */
  async function exitDust() {
    if (!address) return;
    setBusy(true);
    try {
      await ensureBase();
      for (const h of holdings.filter((x) => x.quoteEth < DUST_WEI)) {
        const wait = await cooldownLeft(h.source, address);
        if (wait > 0n) throw new Error(`Cooldown on the ${h.source.label}: retry in ${wait.toString()} s.`);
        setStatus(`Withdrawing the dust from the ${h.source.label} in kind…`);
        const hash = await writeContract(wagmiConfig, {
          address: h.source.address, abi: LEGACY_ABI, functionName: "sellGBLIN", args: [h.balance],
          chainId: base.id, dataSuffix: BUILDER_CODE_SUFFIX,
        });
        const r = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: base.id });
        if (r.status !== "success") throw new Error("The in-kind withdrawal reverted.");
      }
      setStatus("✅ Dust withdrawn in kind.");
      await refresh();
    } catch (e) { setStatus(explain(e) ?? "Cancelled in the wallet. Nothing was sold."); } finally { setBusy(false); }
  }

  async function finishPending() {
    if (!address || pending === null) return;
    setBusy(true);
    try {
      await ensureBase();
      const closed = await newVaultOpen(address);
      if (closed) { setStatus(closed); return; }
      const bal = (await getBalance(wagmiConfig, { address, chainId: base.id })).value;
      const ethIn = pending < bal - GAS_RESERVE ? pending : bal > GAS_RESERVE ? bal - GAS_RESERVE : 0n;
      if (ethIn === 0n) { writePending(address, null); setPending(null); return; }
      setStatus("Finishing: buying the new vault…");
      await buyNew(address, ethIn);
      writePending(address, null); setPending(null);
      setStatus("✅ Migration complete.");
    } catch (e) { setStatus(explain(e) ?? "Cancelled in the wallet. Nothing was sold."); } finally { setBusy(false); }
  }

  // The panel stays mounted while it is working, while it has something to say, and when the
  // previous contracts could not be read. Unmounting on the click removes the button, the
  // outcome and the error together, which reads as "it did nothing".
  const nothingToShow = holdings.length === 0 && pending === null && !status && !unreadable;
  // `address` goes briefly undefined while the wallet switches chain. Unmounting then would
  // take the button away mid-click, which reads as "nothing happened".
  if (!busy && (!address || nothingToShow)) return null;

  const migratable = holdings.filter((h) => h.quoteEth >= DUST_WEI);
  const dust = holdings.filter((h) => h.quoteEth < DUST_WEI);
  const totalQuote = migratable.reduce((a, h) => a + h.quoteEth, 0n);
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
      {migratable.length > 0 && (
        <div className="text-sm text-emerald-100">
          You still hold GBLIN on a previous contract (≈ {Number(formatEther(totalQuote)).toFixed(5)} ETH at NAV).
          Migrate to the vault in service: sold for ETH at a guaranteed minimum and bought back right after, never below NAV − 3%.
        </div>
      )}
      {pending !== null && (
        <div className="text-sm text-amber-200">
          A migration stopped halfway: {Number(formatEther(pending)).toFixed(5)} ETH is in your wallet, waiting to be deposited.
        </div>
      )}
      {unreadable && (
        <div className="text-sm text-amber-200">
          The previous contracts did not answer, so whether anything is left on them is unknown right now.
          Nothing has been sold. Reload in a few minutes.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {migratable.length > 0 && (
          <button type="button" onClick={migrateAll} disabled={busy}
            className="rounded-full px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] transition border border-emerald-400/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50">
            {busy ? "Working…" : "Migrate"}
          </button>
        )}
        {dust.length > 0 && (
          <button type="button" onClick={exitDust} disabled={busy}
            title="Positions this small cannot be sold for ETH; you receive the underlying tokens instead"
            className="text-xs text-zinc-300 underline decoration-zinc-500/40 underline-offset-4 transition hover:text-white disabled:opacity-50">
            Withdraw dust in kind
          </button>
        )}
        {pending !== null && (
          <button type="button" onClick={finishPending} disabled={busy}
            className="rounded-full px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] transition border border-amber-400/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30 disabled:opacity-50">
            Finish migration
          </button>
        )}
      </div>
      {status && <div className="text-xs text-zinc-300">{status}</div>}
    </div>
  );
}

const queryClient = new QueryClient();

export default function MigrateToNewVault() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MigrateBanner />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
