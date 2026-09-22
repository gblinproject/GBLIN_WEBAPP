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
// ETH kept back so the second transaction can always be paid for. The deposit costs around
// 570,000 gas, which at a quiet gas price is a fraction of a cent -- but a reserve sized on the
// quiet price leaves nothing when the price rises, and the holder is then stranded with the
// proceeds in the wallet and no way to pay for the deposit. This is deliberately generous
// relative to what is being migrated: what is left over stays in the wallet either way.
const GAS_RESERVE = 300_000_000_000_000n; // 0.0003 ETH
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
// Reading the previous contract's own redemption arithmetic, so the in-kind route can predict what a
// redemption pays before it happens: pro rata on the circulating supply, with the stability fund kept
// out of the WETH leg. Same formula as its `_getPreBurnShares`.
const LEGACY_SHARE_ABI = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function stabilityFund() view returns (uint256)",
]);
const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
const ORACLE_ABI = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"]);
// Everything the vault needs to price an in-kind deposit before it happens: the basket row, what the
// vault already holds of it, and the two parameters of the in-kind fee.
const VAULT_VIEW_ABI = parseAbi(["function totalEthValue(uint256 extra) view returns (uint256)"]);
const LENS_VIEW_ABI = parseAbi([
  "function asset(address v, uint256 i) view returns (address token, address oracle, bool isStable, bool delisted, uint256 baseWeight, uint256 dynamicWeight, bool shielded, bool abandoned)",
  "function reservedAmount(address v, address token) view returns (uint256)",
  "function configAuction(address v) view returns (uint256 driftBand, uint256 driftClose, uint256 auctionStart, uint256 auctionCap, uint256 auctionRamp, uint256 volUpdateInterval, uint256 listingDelay, uint256 inKindFee, uint256 inKindTax)",
]);
// The three basket assets, identical on both previous contracts and on the vault in service (read on
// chain before this was written). Oracles are the same Chainlink feeds the vault itself prices with.
const CBBTC: Address = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
// Rows of the vault in service: 0 cbBTC, 1 WETH, 2 USDC. WETH is not listed here because the previous
// contracts pay their WETH share out as ETH, which mints through `buyGBLIN`.
const IN_KIND_ASSETS: { token: Address; decimals: number; oracle: Address; index: bigint }[] = [
  { token: CBBTC, decimals: 8, oracle: "0x07DA0E54543a844a80ABE69c8A12F22B3aA59f9D", index: 0n },
  { token: USDC, decimals: 6, oracle: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B", index: 2n },
];
const ETH_ORACLE: Address = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
// What the redemption actually pays can be a few units below the reading taken a moment earlier
// (rounding, a deposit landing in between), and a deposit call that asks for more than arrived would
// revert the whole batch. The remainder stays in the wallet.
const IN_KIND_MARGIN_BPS = 50n;
// Fee tier of the pools the previous contracts swap their cbBTC and USDC legs through (read on chain from
// their basket rows: 500 = 0.05%).
const POOL_FEE_BPS = 5n;
const VAULT_ABI = parseAbi([
  "function buyGBLIN(uint256 minOut) payable",
  "function buyGBLINInKind(address token, uint256 amountIn, uint256 minOut)",
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

  /** Every call carries the app's on-chain attribution suffix, as the single calls already do. */
  function withCode(data: `0x${string}`): `0x${string}` {
    return (data + BUILDER_CODE_SUFFIX.slice(2)) as `0x${string}`;
  }

  async function minSharesFor(ethIn: bigint): Promise<bigint> {
    const [out] = await readContract(wagmiConfig, { address: NEW_LENS, abi: LENS_ABI, functionName: "quoteBuy", args: [NEW_VAULT, ethIn], chainId: base.id });
    return out - (out * BUY_SLIPPAGE_BPS) / 10_000n;
  }

  async function buyNew(account: Address, ethIn: bigint) {
    const minOut = await minSharesFor(ethIn);
    const hash = await writeContract(wagmiConfig, {
      account, address: NEW_VAULT, abi: VAULT_ABI, functionName: "buyGBLIN", args: [minOut], value: ethIn,
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

  /**
   * The in-kind route, which never touches a pool.
   *
   * Redeeming for ETH on a previous contract sells the cbBTC and USDC legs on Uniswap: the holder pays
   * the pool fee and the slippage, and a leg whose swap fails is skipped in silence. Redeeming in kind
   * pays out the underlying instead, and the vault in service takes each asset at its oracle price. So
   * the whole migration settles between the two contracts, at net asset value on both sides.
   *
   * The amounts are predicted with the previous contract's own formula because an atomic batch has to
   * be built before the redemption runs. They are then shaded by IN_KIND_MARGIN_BPS so a deposit can
   * never ask for more than the redemption delivered.
   */
  /** The in-kind mint fee the vault will charge for `ethValue` on row `index`, as ShieldLib computes it. */
  async function inKindFeeBps(index: bigint, ethValue: bigint, totalEth: bigint, ethPrice: bigint, asset: { token: Address; decimals: number; oracle: Address }) {
    const [, , , , , dynamicWeight] = await readContract(wagmiConfig, { address: NEW_LENS, abi: LENS_VIEW_ABI, functionName: "asset", args: [NEW_VAULT, index], chainId: base.id });
    const [, , , , , , , floorBps, taxBps] = await readContract(wagmiConfig, { address: NEW_LENS, abi: LENS_VIEW_ABI, functionName: "configAuction", args: [NEW_VAULT], chainId: base.id });
    const target = (totalEth * dynamicWeight) / 10_000n;
    if (target === 0n) return floorBps + taxBps;
    const [held, reserved, price] = await Promise.all([
      readContract(wagmiConfig, { address: asset.token, abi: ERC20_ABI, functionName: "balanceOf", args: [NEW_VAULT], chainId: base.id }),
      readContract(wagmiConfig, { address: NEW_LENS, abi: LENS_VIEW_ABI, functionName: "reservedAmount", args: [NEW_VAULT, asset.token], chainId: base.id }),
      readContract(wagmiConfig, { address: asset.oracle, abi: ORACLE_ABI, functionName: "latestRoundData", chainId: base.id }).then((r) => r[1]),
    ]);
    const free = held > reserved ? held - reserved : 0n;
    const rawCur = (free * price) / ethPrice;
    const cur = asset.decimals < 18 ? rawCur * 10n ** BigInt(18 - asset.decimals) : rawCur / 10n ** BigInt(asset.decimals - 18);
    const diffBefore = cur > target ? cur - target : target - cur;
    const after = cur + ethValue;
    const diffAfter = after > target ? after - target : target - after;
    if (diffAfter < diffBefore) return floorBps;
    let average = (diffBefore + diffAfter) / 2n;
    if (average > target) average = target;
    return floorBps + (taxBps * average) / target;
  }

  async function inKindCalls(s: Source, balance: bigint) {
    const [supply, heldByContract, stabilityFund, wethBal] = await Promise.all([
      readContract(wagmiConfig, { address: s.address, abi: LEGACY_SHARE_ABI, functionName: "totalSupply", chainId: base.id }),
      readContract(wagmiConfig, { address: s.address, abi: LEGACY_ABI, functionName: "balanceOf", args: [s.address], chainId: base.id }),
      readContract(wagmiConfig, { address: s.address, abi: LEGACY_SHARE_ABI, functionName: "stabilityFund", chainId: base.id }).catch(() => 0n),
      readContract(wagmiConfig, { address: WETH, abi: ERC20_ABI, functionName: "balanceOf", args: [s.address], chainId: base.id }),
    ]);
    const circulating = supply - heldByContract; // the contract's own _circulating()
    if (circulating === 0n) throw new Error("The previous contract reports no circulating supply.");

    const shade = (v: bigint) => (v * (10_000n - IN_KIND_MARGIN_BPS)) / 10_000n;
    const ethPrice = (await readContract(wagmiConfig, { address: ETH_ORACLE, abi: ORACLE_ABI, functionName: "latestRoundData", chainId: base.id }))[1];
    if (ethPrice <= 0n) throw new Error("The ETH price feed is unusable right now.");

    const calls: { to: Address; value?: bigint; data: `0x${string}` }[] = [
      { to: s.address, data: withCode(encodeFunctionData({ abi: LEGACY_ABI, functionName: "sellGBLIN", args: [balance] })) },
    ];
    // What this route is expected to mint, so it can be compared with the ETH route before either runs.
    const totalEth = await readContract(wagmiConfig, { address: NEW_VAULT, abi: VAULT_VIEW_ABI, functionName: "totalEthValue", args: [0n], chainId: base.id });
    let expectedShares = 0n;
    let swappedEthValue = 0n; // value of the legs the ETH route would sell on a pool

    for (const a of IN_KIND_ASSETS) {
      const held = await readContract(wagmiConfig, { address: a.token, abi: ERC20_ABI, functionName: "balanceOf", args: [s.address], chainId: base.id });
      const amountIn = shade((held * balance) / circulating);
      if (amountIn === 0n) continue;
      // ethValue as the vault computes it: the asset's feed against the ETH feed.
      const price = (await readContract(wagmiConfig, { address: a.oracle, abi: ORACLE_ABI, functionName: "latestRoundData", chainId: base.id }))[1];
      if (price <= 0n) throw new Error("A price feed is unusable right now.");
      const raw = (amountIn * price) / ethPrice;
      const ethValue = a.decimals < 18 ? raw * 10n ** BigInt(18 - a.decimals) : raw / 10n ** BigInt(a.decimals - 18);
      const [quoted] = await readContract(wagmiConfig, { address: NEW_LENS, abi: LENS_ABI, functionName: "quoteBuy", args: [NEW_VAULT, ethValue], chainId: base.id });
      // `quoteBuy` prices an ETH mint, which pays the protocol and stability fees; an in-kind deposit pays
      // the in-kind fee instead, so the quote is restated on that fee before it is compared or bounded.
      swappedEthValue += ethValue;
      const fee = await inKindFeeBps(a.index, ethValue, totalEth, ethPrice, a);
      const expected = (quoted * (10_000n - fee)) / 9_990n;
      expectedShares += expected;
      const minOut = expected - (expected * 300n) / 10_000n;
      calls.push({ to: a.token, data: withCode(encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [NEW_VAULT, amountIn] })) });
      calls.push({ to: NEW_VAULT, data: withCode(encodeFunctionData({ abi: VAULT_ABI, functionName: "buyGBLINInKind", args: [a.token, amountIn, minOut] })) });
    }

    // The WETH leg is paid out as ETH, net of the stability fund, exactly as the contract does it.
    const availableWeth = wethBal > stabilityFund ? wethBal - stabilityFund : 0n;
    const ethOut = shade((availableWeth * balance) / circulating);
    if (ethOut > 0n) {
      const [quotedEth] = await readContract(wagmiConfig, { address: NEW_LENS, abi: LENS_ABI, functionName: "quoteBuy", args: [NEW_VAULT, ethOut], chainId: base.id });
      expectedShares += quotedEth;
      const minOut = await minSharesFor(ethOut);
      calls.push({ to: NEW_VAULT, value: ethOut, data: withCode(encodeFunctionData({ abi: VAULT_ABI, functionName: "buyGBLIN", args: [minOut] })) });
    }
    if (calls.length === 1) throw new Error("The previous contract holds nothing to migrate.");
    return { calls, expectedShares, swappedEthValue };
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
    // Each route is simulated with the redemption it actually uses: in kind for the batch, for ETH for
    // the fallback. Simulating the ETH redemption for both would let a stalled pool block the route that
    // does not need a pool at all.
    const canBatch = await supportsAtomicBatch(account);
    if (!canBatch) {
      await simulateContract(wagmiConfig, { address: s.address, abi: LEGACY_ABI, functionName: "sellGBLINForEth", args: [balance, minEthOut], account, chainId: base.id });
    }

    // One confirmation whenever the wallet can batch atomically, and that confirmation carries the in-kind
    // route: redeem the underlying and deposit it at net asset value, with no pool anywhere. A requirement
    // that the wallet already hold the proceeds was added after wallets reported "not enough ETH for the
    // network fee" on the batch; the cause turned out to be the connector, which sent the request for a
    // different, empty account (fixed in src/lib/wagmi.ts). Should a wallet still refuse the batch, nothing
    // has moved and the two-step path below takes over.
    const ethHeld = (await getBalance(wagmiConfig, { address: account, chainId: base.id })).value;
    if (canBatch) {
      try {
        // Two routes, one confirmation either way. In kind redeems the underlying and deposits it at the
        // oracle price, with no pool anywhere, but the vault charges an in-kind fee that grows when a
        // deposit pushes a row away from its target weight. Redeeming for ETH sells the cbBTC and USDC
        // legs on a pool instead. Both outcomes are quoted first and the better one is used.
        const inKind = await inKindCalls(s, balance).catch(() => null);
        // Both routes are compared on what they are EXPECTED to mint. Comparing against the ETH route's
        // guaranteed minimum instead would understate it by the slippage bound and tilt every decision
        // towards the in-kind route.
        const [ethRouteQuoted] = await readContract(wagmiConfig, { address: NEW_LENS, abi: LENS_ABI, functionName: "quoteBuy", args: [NEW_VAULT, quote], chainId: base.id });
        // `quoteSellGBLIN` prices the redemption at the oracle, so it ignores what the swaps cost. The pool
        // fee on the legs the previous contract actually sells (0.05% on each) is taken off here. Price
        // impact is not modelled: at these sizes the cbBTC/WETH and USDC/WETH pools are deep.
        const swapped = inKind ? inKind.swappedEthValue : 0n;
        const ethRouteShares = swapped > 0n && quote > 0n
          ? ethRouteQuoted - (ethRouteQuoted * POOL_FEE_BPS * swapped) / (10_000n * quote)
          : ethRouteQuoted;
        const useInKind = inKind !== null && inKind.expectedShares > ethRouteShares;
        setStatus(
          useInKind
            ? `Migrating from the ${s.label} in one confirmation, without touching a pool…`
            : `Migrating from the ${s.label} in one confirmation…`,
        );
        const calls = useInKind
          ? inKind.calls
          : [
              { to: s.address, data: withCode(encodeFunctionData({ abi: LEGACY_ABI, functionName: "sellGBLINForEth", args: [balance, minEthOut] })) },
              { to: NEW_VAULT, value: minEthOut, data: withCode(encodeFunctionData({ abi: VAULT_ABI, functionName: "buyGBLIN", args: [await minSharesFor(minEthOut)] })) },
            ];
        const { id } = await sendCalls(wagmiConfig, { account, chainId: base.id, forceAtomic: true, calls });
        const res = await waitForCallsStatus(wagmiConfig, { id });
        if (res.status !== "success") throw new Error("batch not successful");
        return;
      } catch (e) {
        // A refusal in the wallet is a decision, not a fault: it is not retried another way.
        if (explain(e) === null) throw e;
        // Nothing moved: the batch is atomic, so falling back cannot sell twice. The fallback redeems
        // for ETH instead, which sells the cbBTC and USDC legs on Uniswap — the holder pays the pool
        // fee and the slippage there, which is why the in-kind batch above is tried first.
        setStatus("The wallet refused the single confirmation. Falling back to two confirmations, which sell the basket legs on a pool…");
      }
    }

    setStatus(`1/2 Selling on the ${s.label}: confirm in the wallet…`);
    const before = ethHeld;
    const sellHash = await writeContract(wagmiConfig, {
      account, address: s.address, abi: LEGACY_ABI, functionName: "sellGBLINForEth", args: [balance, minEthOut],
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
          account: address, address: h.source.address, abi: LEGACY_ABI, functionName: "sellGBLIN", args: [h.balance],
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
