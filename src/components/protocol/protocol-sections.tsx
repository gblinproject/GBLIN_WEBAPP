/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { ethers } from 'ethers';
import { useState, useEffect, useCallback } from 'react';
import { useConnect } from 'wagmi';
import type { ReactNode } from 'react';
import { Activity, ArrowRight, Check, TrendingUp, ChevronDown, Copy, ExternalLink, Landmark, RefreshCw, Shield, Wallet, X, Zap, Lock } from 'lucide-react';
import type { BasketItem, DashboardData, OnChainData, OracleHealth, TransactionItem } from './protocol-data';
import { CONTRACT_ADDRESS, DISPLAY_CONTRACT_ADDRESS, ERC20_ABI, formatCurrency, formatPercent, formatTokenAmount, quoteTokenToWeth, RPC_URL, shortenAddress, TRADE_TOKEN_OPTIONS, WHITEPAPER_URL } from './protocol-data';
import type { TradeTokenOption } from './protocol-data';
import { WhaleDepositPanel } from './whale-deposit-panel';
import MigrateToNewVault from "@/components/MigrateToNewVault";
import { ProofSection, FeeEngineSection } from './proof-section';
import { NavFeesHeroLedger } from './nav-fees';
import { ReserveCore } from './reserve-core';
import { AgentActivity } from './agent-activity';
import { AssetMark } from './asset-mark';
import { AddToWallet } from './add-to-wallet';

// Closed auction: say how far the basket is from target and where the auction opens, both read from the
// contract, instead of claiming the basket is on target while a row sits several points away.
function auctionClosedText(t: (key: string) => string, d: OnChainData | null | undefined): string {
  if (!d || d.driftBps === null || d.driftBandBps === null) return t('ui.home.auctionClosed');
  return t('ui.home.auctionClosedGap')
    .replace('{gap}', formatPercent(d.driftBps / 100, 1))
    .replace('{band}', formatPercent(d.driftBandBps / 100, 0));
}

export type ProtocolView = 'home' | 'dashboard' | 'buy' | 'rebalance' | 'vault';

export interface RebalanceCard {
  name: string;
  actualWeight: number | null;
  dynamicWeight: number | null;
  baseWeight: number | null;
  weightGap: number | null;
  directionLabel: string;
  amountLabel: string;
  amountValue: string;
  minFloorLabel: string;
  minFloorValue: string;
  recommendationText: string;
  recommendationTone: string;
  recommendationDot: string;
  containerClass: string;
}

export interface RebalanceOpportunity {
  name: string;
  basketIndex: number;
  actualWeight: number | null;
  dynamicWeight: number | null;
  baseWeight: number | null;
  recommendation: string;
  inputSymbol: string;
  inputAmountText: string;
  amountToSwap: bigint;
  targetEthAmount: number;
  executableInputAmount: number;
  eligible: boolean;
  /** Gap between the row and its target, in ETH of value: what a bid can close. */
  minSwapRequiredEth: number;
  /** Token the bidder hands to the vault: the asset when the vault buys it, WETH when the vault sells it. */
  inputToken: string;
  inputDecimals: number;
  /** True when the vault buys the asset and pays WETH; the first argument of `bid`. */
  vaultBuysAsset: boolean;
}

interface SharedViewProps {
  t: (key: string) => string;
  /** Active interface language: decimal separators and dates follow it. */
  language: string;
  marketData: DashboardData | null;
  onChainData: OnChainData | null;
  basketData: BasketItem[];
  lastYieldDistribution: number;
  discountPercentage: number;
  isMarketLoading: boolean;
  isOnChainLoading: boolean;
  isTransactionsLoading: boolean;
  transactions: TransactionItem[];
  logs: string[];
  refreshAllData: () => void;
  isConnected: boolean;
  address?: string;
  openWallet: () => void;
  disconnectWallet: () => void;
  copyContract: () => void;
  copied: boolean;
}

interface HomeViewProps extends SharedViewProps {}

interface DashboardViewProps extends SharedViewProps {}

interface BuyViewProps extends SharedViewProps {
  buyTokenOptions: string[];
  customTokenAddress: string;
  mode: 'buy' | 'sell' | 'inkind';
  inputBalance: string;
  setMode: (mode: 'buy' | 'sell' | 'inkind') => void;
  amount: string;
  setAmount: (value: string) => void;
  quoteAssetLabel: string;
  redeemOption: 'eth' | 'basket';
  isEthRedeemBlocked: boolean;
  /** Basket tokens that reverted on balanceOf(vault); while any is listed no redemption is sent. */
  muteLegs?: string[];
  oracleHealth: OracleHealth;
  resolvedTokenSymbol: string;
  selectedToken: string;
  setCustomTokenAddress: (value: string) => void;
  setRedeemOption: (value: 'eth' | 'basket') => void;
  setSelectedToken: (value: string) => void;
  slippage: number;
  setSlippage: (value: number) => void;
  quote: string;
  usdValue: string;
  isLoadingQuote: boolean;
  isTransacting: boolean;
  isTradeDisabled: boolean;
  executeTrade: () => void;
  tradeError: string | null;
  tradeTxHash: string | null;
  ethBalance: string;
  gblinBalance: string;
  tokenBalance: string;
}

interface RebalanceViewProps extends SharedViewProps {
  rebalanceOverviewCards: RebalanceCard[];
  autoRebalanceOpportunity: RebalanceOpportunity | null;
  rebalanceBountyActive: boolean;
  rebalanceMinSwapRequiredEth: number;
  isArbitraging: boolean;
  isArbDisabled: boolean;
  executeArbitrage: () => void;
  arbError: string | null;
  arbTxHash: string | null;
  eligibleRebalanceCount: number;
  isRebalancingAll: boolean;
  executeRebalanceAll: () => void;
  rebalanceAllProgress: { current: number; total: number; currentAsset: string } | null;
  rebalanceAllResults: Array<{ name: string; hash: string; success: boolean; error?: string }>;
}

interface VaultViewProps extends SharedViewProps {}

const shellCard = 'g-card-elevated';

const sectionTitle = 'text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[2.25rem]';
const sectionBody = 'max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base';

function formatWeight(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '--';
  return formatPercent(value);
}

function formatDateLabel(timestamp: number) {
  if (!timestamp) return '--';
  return new Date(timestamp * 1000).toLocaleString();
}

function MetricCard({ label, value, hint, loading }: { label: string; value: string; hint?: string; loading?: boolean }) {
  // Mono is for figures. On a phrase it reads like a terminal glitch, so words get the
  // text face and a smaller size instead.
  const numeric = /^[^A-Za-z]*$/.test(value.replace(/[a-z]{1,3}$/i, ''));
  return (
    <div className="g-card flex h-full flex-col p-5">
      <p className="g-eyebrow">{label}</p>
      <p
        className={`mt-3 leading-tight text-white ${
          numeric ? 'tnum font-mono text-2xl font-medium tracking-tight sm:text-[1.75rem]' : 'text-lg font-semibold tracking-tight sm:text-xl'
        } ${loading ? 'animate-pulse text-zinc-500' : ''}`}
      >
        {loading ? '…' : value}
      </p>
      {hint ? <p className="mt-auto pt-2 text-xs leading-5 text-zinc-500">{hint}</p> : null}
    </div>
  );
}


function SectionHeading({ eyebrow, title, body, actions }: { eyebrow?: string; title: string; body?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="g-eyebrow g-eyebrow-gold">{eyebrow}</p> : null}
        <h2 className={`mt-2 ${sectionTitle}`}>{title}</h2>
        {body ? <p className={`mt-3 ${sectionBody}`}>{body}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

/**
 * The basket drawn, not listed. The page had no graphic at all: nine sections of
 * boxed text read as documentation rather than a product, and the one number that
 * matters had a thin progress bar under it. Inline SVG on live weights, so it costs
 * no dependency and cannot drift from the data beside it.
 */
/**
 * One horizontal break in a page that is otherwise a stack of cards, and the place
 * where the figures that used to be repeated in the hero now live once.
 */
function LiveTicker({ t, onChainData, basket }: { t: (key: string) => string; onChainData: OnChainData | null; basket: BasketItem[] }) {
  const [agents, setAgents] = useState<{ calls: number; wallets: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/agent-stats')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((d: { total_paid_calls?: number; total_unique_agents?: number; organic?: { paid_calls?: number; unique_agents?: number } }) => {
        if (cancelled) return;
        const calls = Number(d?.organic?.paid_calls ?? d?.total_paid_calls ?? 0);
        const wallets = Number(d?.organic?.unique_agents ?? d?.total_unique_agents ?? 0);
        if (calls > 0) setAgents({ calls, wallets });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const items: Array<{ k: string; v: string }> = [
    { k: t('ui.home.statNav'), v: onChainData?.nav || '—' },
    { k: t('ui.home.statTvl'), v: formatCurrency(onChainData?.tvl || 0) },
    ...basket.map((a) => ({ k: a.name, v: formatWeight(a.realWeight) })),
    { k: t('ui.home.statFee'), v: `${((onChainData?.managementFeeBps ?? 0) / 100).toFixed(2)}% ${t('ui.home.perYear')}` },
    ...(agents
      ? [{ k: t('ui.home.agentsEyebrow'), v: `${agents.calls} ${t('ui.home.agentsStat').replace('{n}', String(agents.wallets))}` }]
      : []),
    {
      k: t('ui.home.statAuction'),
      v: onChainData
        ? onChainData.auctionOpen
          ? `${t('ui.home.auctionOpen')} · ${onChainData.auctionPremiumBps} bps`
          : auctionClosedText(t, onChainData)
        : '—',
    },
    { k: 'Base', v: shortenAddress(DISPLAY_CONTRACT_ADDRESS) },
  ];

  // The strip runs inside the page column, not edge to edge. The track is
  // duplicated because the animation shifts it by half its width, so the loop
  // closes without a jump.
  const entry = (it: { k: string; v: string }, key: string) => (
    <span className="inline-flex items-baseline gap-2 px-4 sm:gap-3 sm:px-7" key={key}>
      <span className="g-eyebrow">{it.k}</span>
      <span className="tnum font-mono text-[12px] text-[color:var(--ink)] sm:text-[13px]">{it.v}</span>
      <span aria-hidden="true" className="ml-2 h-1 w-1 rounded-full bg-[color:var(--line-gold)] sm:ml-4" />
    </span>
  );

  return (
    <div className="g-ticker overflow-hidden border-y border-[color:var(--line)] py-4">
      <div className="g-ticker-track">
        {items.map((it, i) => entry(it, `a${i}`))}
        {items.map((it, i) => (
          <span aria-hidden="true" key={`b${i}`}>
            {entry(it, `b-${i}`)}
          </span>
        ))}
      </div>
    </div>
  );
}



function BasketCard({ asset, t, showPrice = true }: { asset: BasketItem; t: (key: string) => string; showPrice?: boolean }) {
  const target = asset.baseWeight / 100;
  const delta = asset.realWeight - target;
  const rows = [
    { k: t('ui.basket.value'), v: formatCurrency(asset.tvl) },
    { k: t('ui.basket.target'), v: formatWeight(target) },
    { k: t('ui.home.delta'), v: `${delta >= 0 ? '+' : '−'}${formatPercent(Math.abs(delta)).replace('%', '')} pp` },
    ...(showPrice ? [{ k: t('ui.basket.dynamic'), v: formatWeight(asset.dynamicWeight / 100) }] : []),
  ];
  return (
    <div className="g-card g-hover h-full p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-white">{asset.name}</p>
          {showPrice ? (
            <>
              <p className="g-eyebrow mt-1">{t('ui.basket.price')}</p>
              <p className="tnum mt-0.5 text-xl font-semibold text-white">{formatCurrency(asset.price, 2)}</p>
            </>
          ) : null}
        </div>
        <span className="tnum shrink-0 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300">
          {formatWeight(asset.realWeight)}
        </span>
      </div>
      <dl className="mt-4 divide-y divide-white/[0.06]">
        {rows.map((r) => (
          <div className="flex items-center justify-between py-2 text-sm" key={r.k}>
            <dt className="text-zinc-500">{r.k}</dt>
            <dd className="tnum font-medium text-zinc-200">{r.v}</dd>
          </div>
        ))}
      </dl>
      {asset.shielded ? <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-amber-300">{t('ui.basket.shield')}</p> : null}
    </div>
  );
}

function TransactionTable({ t, transactions, isTransactionsLoading }: { t: (key: string) => string; transactions: TransactionItem[]; isTransactionsLoading: boolean }) {
  return (
    <div className={`${shellCard} overflow-hidden`}>
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-sm font-semibold text-white">{t('dashboard.txTitle')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-zinc-300">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-5 py-4 font-medium">{t('dashboard.txType')}</th>
              <th className="px-5 py-4 font-medium">{t('dashboard.txHash')}</th>
              <th className="px-5 py-4 font-medium">{t('dashboard.txFrom')}</th>
              <th className="px-5 py-4 font-medium">{t('dashboard.txValue')}</th>
              <th className="px-5 py-4 font-medium">{t('dashboard.txTime')}</th>
            </tr>
          </thead>
          <tbody>
            {isTransactionsLoading ? (
              <tr>
                <td className="px-5 py-6 text-zinc-500" colSpan={5}>...</td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-zinc-500" colSpan={5}>{t('dashboard.noTransactions')}</td>
              </tr>
            ) : (
              transactions.slice(0, 10).map((tx) => (
                <tr className="border-t border-white/5" key={tx.full_hash}>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${tx.is_rebalance ? 'bg-amber-500/10 text-amber-300' : tx.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-300' : tx.type === 'SELL' ? 'bg-rose-500/10 text-rose-300' : tx.type === 'APPROVE' ? 'bg-violet-500/10 text-violet-300' : 'bg-sky-500/10 text-sky-300'}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-white">
                    <a className="inline-flex items-center gap-2 hover:text-amber-200" href={`https://basescan.org/tx/${tx.full_hash}`} rel="noreferrer" target="_blank">
                      {tx.hash}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                  <td className="px-5 py-4">{tx.from}</td>
                  <td className="px-5 py-4 text-white">{tx.value}</td>
                  <td className="px-5 py-4">{tx.time}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WalletPanel({ isConnected, address, openWallet, disconnectWallet, t }: { isConnected: boolean; address?: string; openWallet: () => void; disconnectWallet: () => void; t: (key: string) => string }) {
  return (
    <div className={`${shellCard} p-5`}>
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-amber-300">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-zinc-500">Wallet</p>
          <p className="mt-1 text-base font-semibold text-white">{isConnected && address ? shortenAddress(address) : t('trade.connectWallet')}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-100" onClick={isConnected ? disconnectWallet : openWallet} type="button">
          <Wallet className="h-4 w-4" />
          {isConnected ? t('trade.disconnect') : t('trade.connectWallet')}
        </button>
      </div>
    </div>
  );
}

/**
 * Autonomous agents that paid to use the protocol, next to the NAV card in the
 * hero. Counts only — the lifetime USDC total lives on /observatory, where the
 * conflict-of-interest note that qualifies it sits with it.
 *
 * Renders nothing until real numbers arrive: a hero that flashes zeros reads
 * worse than a hero that never mentioned agents.
 */
function AgentPulse({ t }: { t: (key: string) => string }) {
  const [stats, setStats] = useState<{ calls: number; agents: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/agent-stats')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((data: {
        total_paid_calls?: number;
        total_unique_agents?: number;
        organic?: { paid_calls?: number; unique_agents?: number };
      }) => {
        if (cancelled) return;
        // The ORGANIC figure is the one displayed: calls paid from protocol-operated wallets
        // are a sizeable share of the total and would inflate a headline number. The cumulative
        // total stays published on the endpoint, where the distinction is documented.
        const calls = Number(data?.organic?.paid_calls ?? data?.total_paid_calls ?? 0);
        const agents = Number(data?.organic?.unique_agents ?? data?.total_unique_agents ?? 0);
        if (calls > 0 || agents > 0) setStats({ calls, agents });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) return null;

  return (
    <Link
      className="group g-card g-hover mt-4 block p-5"
      href="/observatory"
    >
      {/* items-start keeps the dot on the first line when the label wraps on mobile. */}
      <div className="flex items-start gap-2">
        <span className="gblin-blink mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
        <p className="g-eyebrow">{t('landing.agentsEyebrow')}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="tnum text-2xl font-semibold leading-none tracking-tight text-white">
            {stats.agents.toLocaleString('en-US')}
          </p>
          <p className="mt-2 text-[11px] leading-5 text-zinc-400">{t('landing.agentsUnique')}</p>
        </div>
        <div>
          <p className="tnum text-2xl font-semibold leading-none tracking-tight text-white">
            {stats.calls.toLocaleString('en-US')}
          </p>
          <p className="mt-2 text-[11px] leading-5 text-zinc-400">{t('landing.agentsCalls')}</p>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-5 text-zinc-500">{t('landing.agentsHint')}</p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 transition group-hover:text-amber-200">
        {t('landing.agentsCta')}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

interface MintVsPoolRow {
  usd: number;
  mintUsd: number;
  poolUsd: number;
  extraPct: number;
}

interface MintVsPoolPayload {
  ethUsd: number;
  mintUsd: number;
  poolLiquidityUsd: number;
  rows: MintVsPoolRow[];
  updatedAt: number;
}

/**
 * The single fact that separates this token from anything sold out of a
 * liquidity pool: the contract quotes the same price per token at any order
 * size. Shown as a live side-by-side rather than a claim, because the visitor
 * can re-read both legs on BaseScan.
 *
 * This section is also where the DEX links live. They used to sit in the hero,
 * which sent buyers into a pool holding a few hundred dollars.
 */
function MintVsPoolSection({ t }: { t: (key: string) => string }) {
  const [data, setData] = useState<MintVsPoolPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/mint-vs-pool')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((payload: MintVsPoolPayload) => {
        if (Array.isArray(payload?.rows) && payload.rows.length > 0) setData(payload);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);

  // Nothing verified means nothing shown — an empty comparison is worse than none.
  if (failed && !data) return null;

  const rows = data?.rows ?? [];

  return (
    <section className="g-card-elevated relative overflow-hidden">
      <div className="p-6 sm:p-8">
        <p className="g-eyebrow g-eyebrow-gold mb-2">{t('landing.mvpEyebrow')}</p>
        <h2 className={`${sectionTitle} mb-3`}>{t('landing.mvpTitle')}</h2>
        <p className="max-w-2xl text-sm leading-7 text-white/50 mb-6">{t('landing.mvpIntro')}</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
                <th className="pb-3 pr-4 font-normal">{t('landing.mvpColSize')}</th>
                <th className="pb-3 pr-4 font-normal text-amber-300">{t('landing.mvpColMint')}</th>
                <th className="pb-3 pr-4 font-normal">{t('landing.mvpColPool')}</th>
                <th className="pb-3 font-normal">{t('landing.mvpColDiff')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0
                ? [0, 1, 2, 3].map(i => (
                    <tr className="border-t border-white/[0.06]" key={i}>
                      <td className="py-4 pr-4" colSpan={4}>
                        <div className="h-4 w-full animate-pulse rounded bg-white/5" />
                      </td>
                    </tr>
                  ))
                : rows.map(row => (
                    <tr className="border-t border-white/[0.06]" key={row.usd}>
                      <td className="py-4 pr-4 font-serif text-lg text-white">${row.usd.toLocaleString('en-US')}</td>
                      <td className="py-4 pr-4 font-mono text-sm text-amber-300">
                        {formatCurrency(row.mintUsd, 2)}
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-zinc-500">/ token</span>
                      </td>
                      <td className="py-4 pr-4 font-mono text-sm text-zinc-400">
                        {formatCurrency(row.poolUsd, 2)}
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-zinc-600">/ token</span>
                      </td>
                      <td className="py-4">
                        {/* Past double the price a percentage stops being readable — say it as a multiple. */}
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.extraPct >= 100 ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>
                          {row.extraPct >= 100
                            ? `×${(row.poolUsd / row.mintUsd).toFixed(1)}`
                            : `+${row.extraPct.toFixed(0)}%`}
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 max-w-3xl text-[11px] leading-6 text-zinc-600">
          {t('landing.mvpFootnote')}{' '}
          <span className="text-zinc-400">{data ? formatCurrency(data.poolLiquidityUsd, 0) : '—'}</span>.{' '}
          {t('landing.mvpFootnote2')}
        </p>

        {/* No DEX routes: the vault in service has no secondary market, and the pools of the previous
            contracts hold a different token. Linking them here would send a buyer to the wrong one. */}
      </div>
    </section>
  );
}

/**
 * States the vault's size before the visitor finds it elsewhere, and explains
 * why the mechanism makes that size not matter for their own entry and exit.
 */
function VaultSizeSection({ t, onChainData }: { t: (key: string) => string; onChainData: OnChainData | null }) {
  const tvl = formatCurrency(onChainData?.tvl || 0);

  return (
    <section className="g-section">
      <div className="flex items-center gap-6">
        <span className="g-eyebrow shrink-0 text-[color:var(--ink)]">{t('landing.sizeEyebrow')}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--line-strong)]" />
      </div>
      <h2 className="font-display mt-7 max-w-[24ch] text-[clamp(1.6rem,3vw,2.25rem)] font-light leading-[1.15] text-[color:var(--ink)]">{t('landing.sizeTitle')}</h2>
      <p className="mt-5 max-w-[42rem] text-[15px] leading-7 text-zinc-500">
        {t('landing.sizeBodyA')} <span className="tnum font-mono text-[color:var(--ink)]">{tvl}</span>{t('landing.sizeBodyB')}
      </p>
      <p className="mt-4 max-w-[42rem] text-[15px] leading-7 text-zinc-500">{t('landing.sizeSupply')}</p>
      <div className="mt-8 flex flex-wrap gap-2">
        <a className="g-chip" href={`https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}`} rel="noopener noreferrer" target="_blank">
          {t('landing.sizeCta')} <ExternalLink className="h-3 w-3" />
        </a>
        <a className="g-chip" href={`https://basescan.org/token/${DISPLAY_CONTRACT_ADDRESS}#balances`} rel="noopener noreferrer" target="_blank">
          {t('landing.sizeHolders')} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </section>
  );
}

export function HomeView(props: HomeViewProps) {
  const { t, language, onChainData, basketData, isOnChainLoading, copyContract, copied } = props;

  const why = [
    { icon: <Landmark className="h-4 w-4" />, title: t('ui.home.why1T'), body: t('ui.home.why1B') },
    { icon: <Shield className="h-4 w-4" />, title: t('ui.home.why2T'), body: t('ui.home.why2B') },
    { icon: <Activity className="h-4 w-4" />, title: t('ui.home.why3T'), body: t('ui.home.why3B') },
    { icon: <TrendingUp className="h-4 w-4" />, title: t('ui.home.why4T'), body: t('ui.home.why4B') },
  ];
  const security = [
    { title: t('ui.home.sec1Title'), body: t('ui.home.sec1Body'), href: `https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}#readContract`, label: t('landing.proofVerify') },
    { title: t('ui.home.sec2Title'), body: t('ui.home.sec2Body'), href: 'https://basescan.org/address/0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd', label: t('ui.home.linkTimelock') },
    { title: t('ui.home.sec3Title'), body: t('ui.home.sec3Body'), href: 'https://github.com/gblinproject/GBLIN-Protocol', label: t('ui.home.linkSource') },
    { title: t('ui.home.sec4Title'), body: t('ui.home.sec4Body'), href: 'https://github.com/gblinproject/GBLIN-Protocol/blob/main/audits/README.md', label: t('ui.home.linkReview') },
  ];
  const resources = [
    { label: t('site.whitepaper'), href: WHITEPAPER_URL },
    { label: t('site.basescan'), href: `https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}` },
    { label: 'GitHub', href: 'https://github.com/gblinproject' },
    { label: 'DefiLlama', href: 'https://defillama.com/protocol/tvl/global-balanced-liquidity-index' },
  ];

  return (
    <div>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="g-hero relative isolate pb-12 pt-4 lg:pb-20 lg:pt-8">
        {/* The light the hero sits on, taken from the render rather than drawn:
            screen blending keeps only what is brighter than the page, so the
            black of the strip adds nothing and only the glow reaches through. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[190px] w-screen -translate-x-1/2 bg-no-repeat opacity-60 mix-blend-screen"
          style={{
            backgroundImage: 'url("/images/gblin/hero-horizon.jpg")',
            backgroundSize: '100% 100%',
            backgroundPosition: 'center bottom',
            // Faded at both ends: the brightest row of the photograph fell on
            // the clipped bottom edge and left a hard rule across the page.
            WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 56%, rgba(0,0,0,0.5) 82%, transparent 100%)',
            maskImage: 'linear-gradient(180deg, transparent 0%, #000 56%, rgba(0,0,0,0.5) 82%, transparent 100%)',
          }}
        />
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-6">
          <div className="min-w-0">
            <p className="g-eyebrow g-eyebrow-gold">{t('ui.home.heroEyebrow')}</p>
            <h1 className="gblin-fade-up font-display mt-7 text-balance text-[clamp(2.3rem,5.1vw,4.1rem)] font-light uppercase leading-[1.06] tracking-[0.03em] text-[color:var(--ink)] [text-wrap:balance]">
              {t('landing.h1a')}
              <br />
              <span className="text-amber-300">{t('landing.h1b')}</span>
            </h1>
            <p className="mt-7 max-w-[34rem] text-[15px] leading-7 text-zinc-400 sm:text-base sm:leading-8">{t('landing.sub')}</p>

            <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link className="g-btn g-btn-primary" href="/buy-gblin">
                {t('landing.cta')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link className="g-link" href="/vault">
                {t('landing.ctaSecondary')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* The one figure that matters, read from the contract. */}
            <div className="mt-12 flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <p className="g-eyebrow">{t('ui.home.statNav')}</p>
                <p className={`tnum mt-2 font-mono text-[clamp(2.1rem,4.4vw,2.9rem)] font-light leading-none text-amber-200 ${isOnChainLoading ? 'animate-pulse text-zinc-700' : ''}`}>
                  {isOnChainLoading ? '—' : onChainData?.nav || '—'}
                </p>
              </div>
              <div className="pb-1">
                <p className="g-eyebrow">{t('ui.home.statAuction')}</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
                  {onChainData?.auctionOpen ? <span className="gblin-blink h-1.5 w-1.5 rounded-full bg-amber-300" /> : null}
                  {onChainData ? (onChainData.auctionOpen ? `${t('ui.home.auctionOpen')} · ${onChainData.auctionPremiumBps} bps` : auctionClosedText(t, onChainData)) : '—'}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <button className="g-chip font-mono" onClick={copyContract} type="button">
                <Copy className="h-3.5 w-3.5" />
                {copied ? t('site.copied') : shortenAddress(DISPLAY_CONTRACT_ADDRESS)}
              </button>
              <a className="g-chip" href={`https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}#readContract`} rel="noopener noreferrer" target="_blank">
                {t('landing.proofVerify')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <AddToWallet t={t} />
            </div>
          </div>

          {/* The reserve core carries the light of the whole page. */}
          <div className="min-w-0">
            <ReserveCore basket={basketData} loading={isOnChainLoading} t={t} />
            {/* Under the core: what agents do with it, external wallets only. */}
            <AgentActivity language={language} t={t} />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- LIVE STRIP ON BASE */}
      <LiveTicker basket={basketData} onChainData={onChainData} t={t} />

      {/* ----------------------------------------------------------- WHY GBLIN */}
      <section className="g-section">
        <div className="flex items-center gap-6">
          <span className="g-eyebrow shrink-0 text-[color:var(--ink)]">{t('ui.home.whyEyebrow')}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--line-strong)]" />
          <span className="g-eyebrow hidden shrink-0 sm:block">{t('ui.home.whyNote')}</span>
        </div>

        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {why.map((item, i) => (
            <div className={`lg:px-8 ${i > 0 ? 'lg:border-l lg:border-[color:var(--line)]' : 'lg:pl-0'} ${i === why.length - 1 ? 'lg:pr-0' : ''}`} key={item.title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--line-gold)] text-amber-300">
                {item.icon}
              </span>
              <p className="mt-6 text-[13px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink)]">{item.title}</p>
              <p className="mt-3 max-w-[26ch] text-sm leading-7 text-zinc-500">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------- PERFORMANCE, TEN YEARS */}
      <ProofSection t={t} />

      {/* ---------------------------------------------------------- THE RESERVE */}
      <section className="g-section">
        <div className="grid items-stretch overflow-hidden rounded-sm border border-[color:var(--line)] bg-[#040404] lg:grid-cols-2">
          {/* The reserve, drawn: one object of light over the dark, bleeding to the page edge. */}
          <div className="relative order-2 aspect-[5/4] w-full overflow-hidden lg:order-1 lg:aspect-auto lg:min-h-[660px]">
            {/* The reserve, photographed: the image carries the light, and its right
                edge is masked so it dissolves into the page instead of ending. */}
            <img
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              height={1280}
              loading="lazy"
              src="/images/gblin/reserve-scene.jpg"
              width={2048}
            />
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, rgba(4,4,4,0.55) 0%, transparent 22%, transparent 62%, rgba(4,4,4,0.85) 92%, #040404 100%), linear-gradient(180deg, #040404 0%, transparent 16%, transparent 82%, #040404 100%)',
              }}
            />
          </div>

          <div className="order-1 min-w-0 px-6 py-12 sm:px-8 lg:order-2 lg:py-16 lg:pl-12 lg:pr-10">
            <div className="flex items-center gap-6">
              <span className="g-eyebrow shrink-0">{t('ui.home.reserveEyebrow')}</span>
              <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--line)]" />
            </div>
            <h2 className="font-display mt-7 text-[clamp(1.9rem,3.6vw,2.75rem)] font-light uppercase leading-[1.08] tracking-[0.02em] text-[color:var(--ink)]">
              {t('ui.home.reserveTitleA')}
              <br />
              {t('ui.home.reserveTitleB')}
            </h2>
            <p className="mt-6 max-w-[38rem] text-[15px] leading-7 text-zinc-500">{t('ui.home.reserveBody')}</p>

            <div className="mt-10 grid gap-px overflow-hidden border-y border-[color:var(--line)] sm:grid-cols-3 sm:border-x-0">
              {(basketData.length > 0 ? basketData : []).map((asset) => (
                <div className="flex items-center gap-3 border-b border-[color:var(--line)] py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:last:border-r-0 sm:first:pl-0" key={asset.address}>
                  <AssetMark className="h-10 w-10 shrink-0" name={asset.name} />
                  <span>
                    <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-300">{asset.name}</span>
                    <span className="tnum mt-0.5 block font-mono text-lg font-light leading-none text-[color:var(--ink)]">{formatWeight(asset.realWeight)}</span>
                    <span className="tnum mt-1 block text-[11px] text-zinc-600">
                      {t('ui.home.target')} {formatPercent(asset.baseWeight / 100, 0)}
                    </span>
                  </span>
                </div>
              ))}
              {basketData.length === 0
                ? ['cbBTC', 'WETH', 'USDC'].map((name) => (
                    <div className="flex items-center gap-3 py-5 sm:px-5" key={name}>
                      <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/[0.04]" />
                      <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">{name}</span>
                    </div>
                  ))
                : null}
            </div>

            <Link className="g-pill mt-8" href="/vault">
              {t('ui.home.reserveCta')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* --------------------------------------------- HOW IT WORKS AND FEES */}
      <section className="g-section">
        <div className="flex items-center gap-6">
          <span className="g-eyebrow shrink-0 text-[color:var(--ink)]">{t('ui.home.howEyebrow')}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--line-strong)]" />
        </div>
        <h2 className="font-display mt-7 max-w-[24ch] text-[clamp(1.6rem,3vw,2.25rem)] font-light leading-[1.15] text-[color:var(--ink)]">{t('ui.home.howTitle')}</h2>
        <p className="mt-5 max-w-[42rem] text-[15px] leading-7 text-zinc-500">{t('yield.desc')}</p>
        <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-0">
          {[
            { title: t('yield.step1Title'), body: t('yield.step1Desc') },
            { title: t('yield.step2Title'), body: t('yield.step2Desc') },
            { title: t('yield.step3Title'), body: t('yield.step3Desc') },
          ].map((item, i) => (
            <div className={`md:px-8 ${i > 0 ? 'md:border-l md:border-[color:var(--line)]' : 'md:pl-0'} ${i === 2 ? 'md:pr-0' : ''}`} key={item.title}>
              <span className="tnum font-mono text-xs text-amber-300/70">0{i + 1}</span>
              <p className="mt-4 text-[13px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink)]">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-zinc-500">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <FeeEngineSection t={t} />
      <MintVsPoolSection t={t} />
      <VaultSizeSection t={t} onChainData={onChainData} />

      {/* -------------------------------------------------------------- VERIFY */}
      <section className="g-section">
        <div className="flex items-center gap-6">
          <span className="g-eyebrow shrink-0 text-[color:var(--ink)]">{t('ui.home.securityEyebrow')}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--line-strong)]" />
        </div>
        <h2 className="font-display mt-7 max-w-[22ch] text-[clamp(1.6rem,3vw,2.25rem)] font-light leading-[1.15] text-[color:var(--ink)]">{t('ui.home.trustTitle')}</h2>
        <p className="mt-5 max-w-[42rem] text-[15px] leading-7 text-zinc-500">{t('ui.home.securityIntro')}</p>
        <div className="mt-10 grid gap-10 border-t border-[color:var(--line)] pt-10 md:grid-cols-4 md:gap-0">
          {security.map((item, i) => (
            <div className={`md:px-6 ${i > 0 ? 'md:border-l md:border-[color:var(--line)]' : 'md:pl-0'} ${i === security.length - 1 ? 'md:pr-0' : ''}`} key={item.title}>
              <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-amber-300">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-zinc-500">{item.body}</p>
              <a className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300 hover:text-amber-200" href={item.href} rel="noopener noreferrer" target="_blank">
                {item.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------- AGENTS */}
      <section className="g-section">
        <div className="grid items-end gap-8 border-y border-[color:var(--line)] py-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="g-eyebrow g-eyebrow-gold">{t('ui.home.agentsEyebrow')}</p>
            <h2 className="font-display mt-4 max-w-[28ch] text-[clamp(1.4rem,2.6vw,2rem)] font-light leading-[1.2] text-[color:var(--ink)]">{t('ui.home.agentsTitle')}</h2>
            <p className="mt-4 max-w-[46rem] text-sm leading-7 text-zinc-500">{t('ui.home.agentsBody')}</p>
          </div>
          <Link className="g-pill" href="/agents">
            {t('ui.home.agentsCta')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* ----------------------------------------------------------- RESOURCES */}
      <section className="pb-16">
        <div className="flex flex-wrap items-center gap-2">
          <span className="g-eyebrow mr-2">{t('ui.home.resourcesTitle')}</span>
          {resources.map((r) => (
            <a className="g-chip" href={r.href} key={r.label} rel="noopener noreferrer" target="_blank">
              {r.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
        {/* Static on purpose: crawlers that never run JS must be able to read which deployment is current. */}
        <p className="mt-8 max-w-3xl text-xs leading-6 text-zinc-600">
          <span className="font-medium text-zinc-500">{t('ui.home.contractNotes')}.</span>{' '}
          Current GBLIN contract on Base: <span className="font-mono text-zinc-500">{DISPLAY_CONTRACT_ADDRESS}</span>. Earlier
          deployments at <span className="font-mono">0x36C81d7E1966310F305eA637e761Cf77F90852f0</span> and{' '}
          <span className="font-mono">0x38DcDB3A381677239BBc652aed9811F2f8496345</span> carry the same name and symbol but are
          superseded: they are not the token this site describes and should not be traded or integrated. Holders of either can
          move across with the migration panel on the account page.
        </p>
      </section>

      {/* One action within thumb reach on phones. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 sm:hidden">
        <Link className="g-btn g-btn-primary pointer-events-auto w-full" href="/buy-gblin">
          {t('landing.cta')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div aria-hidden="true" className="h-14 sm:hidden" />
    </div>
  );
}

export function DashboardView(props: DashboardViewProps) {
  const { t, marketData, onChainData, basketData, discountPercentage, isMarketLoading, isOnChainLoading, transactions, isTransactionsLoading, logs, refreshAllData, copyContract, copied } = props;

  return (
    <div className="space-y-12">
      <section className={`${shellCard} p-7 sm:p-10`}>
        <SectionHeading
          actions={
            <>
              <button className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100" onClick={refreshAllData} type="button">
                <RefreshCw className="h-4 w-4" />
                {t('dashboard.txRefresh')}
              </button>
              <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10" onClick={copyContract} type="button">
                <Copy className="h-4 w-4" />
                {copied ? t('site.copied') : shortenAddress(DISPLAY_CONTRACT_ADDRESS)}
              </button>
            </>
          }
          body={t('dashboard.protocolDesc')}
          eyebrow={t('dashboard.verified')}
          title={t('dashboard.title')}
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard hint={t('dashboard.backing')} label={t('dashboard.priceLabel')} loading={isMarketLoading} value={formatCurrency(marketData?.priceUsd || 0, 4)} />
          <MetricCard hint={t('dashboard.backing')} label={t('dashboard.navTitle')} loading={isOnChainLoading} value={onChainData?.nav || '$0.00'} />
          <MetricCard hint={t('dashboard.assetsInVault')} label={t('dashboard.tvlTitle')} loading={isOnChainLoading} value={formatCurrency(onChainData?.tvl || 0)} />
          <MetricCard hint={t('site.marketDislocation')} label={t('site.discountPremium')} loading={isMarketLoading || isOnChainLoading} value={`${discountPercentage.toFixed(2)}%`} />
        </div>
        {/* Headline figure: total value redistributed to every holder. */}
        <div className="mt-4 rounded-[24px] border border-amber-500/30 bg-amber-500/[0.06] p-6 sm:p-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-amber-300/80">{t('dashboard.totalYieldTitle')}</p>
            <p className="mt-2 font-serif text-4xl sm:text-5xl xl:text-6xl font-semibold leading-none text-amber-300 break-words">{onChainData?.totalYieldDistributed == null ? '—' : `${formatTokenAmount(onChainData.totalYieldDistributed, 6)} WETH`}</p>
          </div>
          <p className="max-w-md text-sm leading-6 text-zinc-300">{t('dashboard.totalYieldDesc')}</p>
        </div>
      </section>

      <section>
        <SectionHeading body={t('vault.desc')} eyebrow={t('core.radarTitle')} title={t('dashboard.assetsInVault')} />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {basketData.map((asset) => (
            <BasketCard asset={asset} key={asset.address} t={t} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <TransactionTable isTransactionsLoading={isTransactionsLoading} t={t} transactions={transactions} />
        <div className="space-y-6">
          <div className={`${shellCard} p-5`}>
            <p className="text-sm font-semibold text-white">{t('site.operationalHeartbeat')}</p>
            <div className="mt-4 space-y-3">
              {logs.length === 0 ? (
                <p className="text-sm text-zinc-500">{t('site.noRecentSyncEvents')}</p>
              ) : (
                logs.map((log, i) => (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300" key={`${i}-${log.substring(0, 15)}`}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className={`${shellCard} p-5`}>
            <p className="text-sm font-semibold text-white">{t('site.reserveEngine')}</p>
            {/* Headline figure: value redistributed to every holder, accruing into NAV. */}
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/80">{t('dashboard.totalYieldTitle')}</p>
              <p className="mt-2 font-serif text-3xl sm:text-4xl font-semibold leading-none text-amber-300 break-words">{onChainData?.totalYieldDistributed == null ? '—' : `${formatTokenAmount(onChainData.totalYieldDistributed, 6)} WETH`}</p>
              <p className="mt-2 text-[11px] leading-5 text-zinc-400">{t('dashboard.totalYieldDesc')}</p>
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('site.managementFee')}</p>
              <p className="mt-2 text-xl font-semibold text-white">{((onChainData?.managementFeeBps ?? 0) / 100).toFixed(2)}% / year</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Fiat config per language ────────────────────────────────────────────────
type InputMode = 'fiat' | 'gblin' | 'crypto';

const FIAT_CONFIG: Record<string, { symbol: string; code: string }> = {
  en: { symbol: '$', code: 'USD' },
  it: { symbol: '€', code: 'EUR' },
  es: { symbol: '€', code: 'EUR' },
  fr: { symbol: '€', code: 'EUR' },
  de: { symbol: '€', code: 'EUR' },
  zh: { symbol: '¥', code: 'CNY' },
  ja: { symbol: '¥', code: 'JPY' },
};

// Approximate FX rates vs USD (static fallback — good enough for UX estimation)
const FX_TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.08, CNY: 0.138, JPY: 0.0067,
};

const TOKEN_GLYPH: Record<string, string> = { ETH: 'Ξ', WETH: 'Ξ', cbBTC: '₿', USDC: '$' };

function TokenGlyph({ symbol }: { symbol: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-[13px] font-semibold text-zinc-200">
      {TOKEN_GLYPH[symbol] ?? symbol.slice(0, 1)}
    </span>
  );
}

/** USD price of one unit of an ERC-20 accepted at the buy step, read from its route to WETH and the ETH feed. */
function useTokenUsdPrice(token: TradeTokenOption | null, ethPriceUsd: number): number {
  const [price, setPrice] = useState(0);
  useEffect(() => {
    let live = true;
    setPrice(0);
    if (!token) return;
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    quoteTokenToWeth(provider, token.address, 10n ** BigInt(token.decimals))
      .then((q) => { if (live && q && q.amountOut > 0n) setPrice(Number(ethers.formatEther(q.amountOut)) * ethPriceUsd); })
      .catch(() => { /* no route: the field falls back to quantities */ });
    return () => { live = false; };
  }, [token, ethPriceUsd]);
  return price;
}

/**
 * Token selector, the way every exchange interface does it: the pill next to the
 * amount opens the list. Before this, that pill switched the input between a
 * currency amount and a share count, which is a different question and surprised
 * anyone who clicked it expecting to pay in another token.
 */
/**
 * Balances of every accepted token for one wallet, read in one pass. Without it the
 * list is a catalogue of tokens the visitor probably does not hold; with it the list
 * is their wallet. A read that fails leaves the entry out rather than showing a zero
 * we did not measure.
 */
function useTokenBalances(address?: string) {
  const [balances, setBalances] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!address) {
      setBalances(null);
      return;
    }
    let cancelled = false;
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    Promise.all(
      TRADE_TOKEN_OPTIONS.map(async (token) => {
        try {
          if (token.isNative) {
            const raw = await provider.getBalance(address);
            return [token.symbol, Number(ethers.formatUnits(raw, 18))] as const;
          }
          const erc20 = new ethers.Contract(token.address, ERC20_ABI, provider);
          const raw: bigint = await erc20.balanceOf(address);
          return [token.symbol, Number(ethers.formatUnits(raw, token.decimals))] as const;
        } catch {
          return null;
        }
      }),
    )
      .then((rows) => {
        if (cancelled) return;
        const out: Record<string, number> = {};
        for (const row of rows) if (row) out[row[0]] = row[1];
        setBalances(out);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [address]);

  return balances;
}

function formatBalance(value: number) {
  if (value === 0) return '0';
  if (value < 0.0001) return value.toExponential(1);
  return value.toLocaleString('en-US', { maximumFractionDigits: value < 1 ? 6 : 4 });
}

function TokenPicker({
  t,
  selected,
  onSelect,
  customAddress,
  setCustomAddress,
  address,
}: {
  t: (key: string) => string;
  selected: string;
  onSelect: (symbol: string) => void;
  customAddress: string;
  setCustomAddress: (value: string) => void;
  address?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const balances = useTokenBalances(address);
  const common = ['ETH', 'USDC', 'cbBTC'];
  const all = TRADE_TOKEN_OPTIONS.map((token) => token.symbol);
  const term = query.trim().toLowerCase();
  const isAddress = term.startsWith('0x') && term.length >= 10;
  // The list is what the visitor can actually pay with: their own balances once a
  // wallet is connected, and ETH alone before that, because a catalogue of tokens
  // nobody has yet is noise on the one screen where they are about to spend.
  // Everything else is one click away under "show all", and search always reaches it.
  const held = balances ? all.filter((sym) => sym === 'ETH' || (balances[sym] ?? 0) > 0) : ['ETH'];
  const base = showAll ? all : held;
  const shown = term ? all.filter((sym) => sym.toLowerCase().includes(term)) : base;
  const hiddenCount = showAll ? 0 : all.length - held.length;
  const label = selected === 'CUSTOM' ? t('ui.token.custom') : selected;

  const pick = (symbol: string) => {
    onSelect(symbol);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] py-1.5 pl-1.5 pr-3 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <TokenGlyph symbol={selected === 'CUSTOM' ? '0x' : selected} />
        <span className="max-w-[7ch] truncate">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-0 z-30 rounded-[1.25rem] border border-white/[0.1] bg-[#0b0b0b] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{t('ui.token.selectToken')}</p>
            <button className="g-btn g-btn-ghost g-btn-sm px-2" onClick={() => setOpen(false)} type="button">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="mt-3 block rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2">
            <input
              className="w-full bg-transparent text-sm text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 placeholder:text-zinc-600"
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('ui.token.search')}
              type="text"
              value={query}
            />
          </label>

          {base.length > common.length && !term ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {common.map((sym) => (
              <button
                className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-semibold transition ${
                  selected === sym ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-white/[0.1] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]'
                }`}
                key={sym}
                onClick={() => pick(sym)}
                type="button"
              >
                <TokenGlyph symbol={sym} />
                {sym}
              </button>
            ))}
          </div>
          ) : null}

          {/* The heading names what is actually on screen: the wallet's tokens, the single
              default way in, or the full catalogue once it has been asked for. */}
          <p className="g-eyebrow mt-4">
            {showAll || term ? t('ui.token.all') : balances ? t('ui.token.yours') : t('ui.token.defaultWay')}
          </p>
          <div className="mt-1 max-h-52 overflow-y-auto">
            {shown.map((sym) => (
              <button
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-white/[0.05]"
                key={sym}
                onClick={() => pick(sym)}
                type="button"
              >
                <TokenGlyph symbol={sym} />
                <span className="flex-1 text-sm font-medium text-zinc-200">{sym}</span>
                {balances && balances[sym] !== undefined ? (
                  <span className="tnum text-xs text-zinc-500">{formatBalance(balances[sym])}</span>
                ) : null}
                {selected === sym ? <Check className="h-4 w-4 text-amber-300" /> : null}
              </button>
            ))}
            {shown.length === 0 && !isAddress ? (
              <p className="px-2 py-3 text-sm text-zinc-500">—</p>
            ) : null}
            {hiddenCount > 0 && !term ? (
              <button
                className="mt-1 w-full rounded-lg px-2 py-2 text-left text-xs font-semibold text-zinc-400 transition hover:bg-white/[0.05] hover:text-amber-300"
                onClick={() => setShowAll(true)}
                type="button"
              >
                {t('ui.token.showAll').replace('{n}', String(hiddenCount))}
              </button>
            ) : null}
          </div>

          <div className="mt-3 border-t border-white/[0.07] pt-3">
            <p className="g-eyebrow">{t('ui.token.custom')}</p>
            <div className="mt-2 flex gap-2">
              <input
                className="w-full rounded-lg border border-white/[0.1] bg-transparent px-3 py-2 font-mono text-xs text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 placeholder:text-zinc-600"
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="0x…"
                type="text"
                value={isAddress ? query : customAddress}
              />
              <button
                className="g-btn g-btn-secondary g-btn-sm"
                onClick={() => {
                  if (isAddress) setCustomAddress(query.trim());
                  pick('CUSTOM');
                }}
                type="button"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Wallet picker rendered where the money moves, so buying is amount then confirm. */
function ConnectInline({ t }: { t: (key: string) => string }) {
  const { connectors, connect, isPending, error } = useConnect();
  const [open, setOpen] = useState(false);
  // The shared config carries both SDK connectors (MetaMask SDK, Coinbase SDK) and the wallets the
  // browser announces through EIP-6963. With the extension installed, both appear under the same name;
  // the SDK one opens a session of its own, with its own account, and the wallet then rejects the
  // request as coming from "a different account". Installed wallets therefore win over SDKs of the same
  // name, as in the wallet menu on /account.
  const isAnnounced = (c: (typeof connectors)[number]) => c.type === 'injected' || c.id.includes('.');
  const ordered = [...connectors].sort((a, b) => Number(isAnnounced(b)) - Number(isAnnounced(a)));
  const seen = new Set<string>();
  const list = ordered.filter((c) => {
    const key = c.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!open) {
    return (
      <button className="g-btn g-btn-primary h-12 w-full text-base" onClick={() => setOpen(true)} type="button">
        <Wallet className="h-4 w-4" />
        {t('trade.connectWallet')}
      </button>
    );
  }
  return (
    <div className="g-card p-2">
      <div className="grid gap-1">
        {list.map((c) => (
          <button
            className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50"
            disabled={isPending}
            key={c.uid}
            onClick={() => connect({ connector: c })}
            type="button"
          >
            {c.name}
            <ArrowRight className="h-4 w-4 text-zinc-500" />
          </button>
        ))}
      </div>
      {error ? <p className="px-3 pb-2 pt-1 text-xs text-rose-300">{error.message.split('.')[0]}</p> : null}
    </div>
  );
}

export function BuyView(props: BuyViewProps) {
  const { t, mode, setMode, amount, setAmount, slippage, setSlippage, quote, usdValue, isLoadingQuote, isTransacting, isTradeDisabled, executeTrade, tradeError, tradeTxHash, ethBalance, gblinBalance, inputBalance, isConnected, openWallet, marketData, onChainData, customTokenAddress, quoteAssetLabel, redeemOption, isEthRedeemBlocked, muteLegs, resolvedTokenSymbol, selectedToken, setCustomTokenAddress, setRedeemOption, setSelectedToken } = props;

  // Detect language from <html lang> attribute (set by ProtocolShell) — lazy init avoids extra render
  const [detectedLang] = useState<string>(() => {
    if (typeof document === 'undefined') return 'en';
    const lang = document.documentElement.lang?.slice(0, 2) || 'en';
    return lang in FIAT_CONFIG ? lang : 'en';
  });

  const fiat = FIAT_CONFIG[detectedLang] ?? FIAT_CONFIG.en;

  // The amount is entered in the visitor's currency in every mode; the token or share quantity is derived
  // from a unit price and shown underneath. "crypto" lets the visitor type the quantity directly.
  const [inputMode, setInputMode] = useState<InputMode>('fiat');
  const [displayValue, setDisplayValue] = useState('');

  const ethPrice = marketData?.ethPriceUsd || 3500;
  const gblinPriceUsd = marketData?.priceUsd || 0;
  const fxRate = FX_TO_USD[fiat.code] ?? 1;                // fiat → USD
  const gblinPriceFiat = gblinPriceUsd / fxRate;            // GBLIN in fiat
  const ethPriceFiat = ethPrice / fxRate;                   // ETH in fiat
  const activeToken = mode === 'buy' ? TRADE_TOKEN_OPTIONS.find((o) => o.symbol === selectedToken) ?? null : null;
  const isCustomToken = mode === 'buy' && !activeToken;
  const tokenPriceUsd = useTokenUsdPrice(activeToken && !activeToken.isNative ? activeToken : null, ethPrice);
  // USD price of one unit of what the visitor pays: ETH from the feed, GBLIN from the NAV, other tokens from their route.
  const unitPriceUsd = mode === 'sell' ? gblinPriceUsd : activeToken?.isNative ? ethPrice : tokenPriceUsd;
  const unitSymbol = mode === 'sell' ? 'GBLIN' : resolvedTokenSymbol || selectedToken;
  const unitDecimals = mode === 'sell' ? 6 : Math.min(activeToken?.decimals ?? 18, 6);
  const payBalance = mode === 'sell' ? gblinBalance : inputBalance;
  // A custom token has no known price: quantities only.
  const fiatEntry = inputMode === 'fiat' && !isCustomToken && unitPriceUsd > 0;

  // Quantity of the paid unit for a currency amount, clamped to the balance when rounding lands just above it.
  const quantityFor = useCallback((raw: string): string => {
    const n = parseFloat(raw.replace(',', '.'));
    if (!raw || isNaN(n) || n <= 0 || unitPriceUsd <= 0) return '';
    const qty = (n * fxRate) / unitPriceUsd;
    const bal = parseFloat(payBalance);
    if (bal > 0 && qty > bal && qty <= bal * 1.01) return payBalance;
    return qty.toFixed(unitDecimals);
  }, [fxRate, payBalance, unitDecimals, unitPriceUsd]);

  useEffect(() => {
    if (mode === 'inkind' || !fiatEntry) return;
    setAmount(quantityFor(displayValue));
  }, [displayValue, fiatEntry, mode, quantityFor, setAmount]);

  // Switching mode or token starts from an empty field in the currency (quantities for a custom token).
  useEffect(() => {
    setInputMode(isCustomToken ? 'crypto' : 'fiat');
    setDisplayValue('');
    setAmount('');
  }, [mode, selectedToken, isCustomToken, setAmount]);

  const countervalue = useCallback((): string => {
    if (fiatEntry) {
      const qty = parseFloat(amount);
      if (!amount || isNaN(qty) || qty <= 0) return '';
      return `≈ ${qty.toFixed(unitDecimals)} ${unitSymbol}`;
    }
    const n = parseFloat(displayValue.replace(',', '.'));
    if (!displayValue || isNaN(n) || n <= 0 || unitPriceUsd <= 0) return '';
    return `≈ ${fiat.symbol}${((n * unitPriceUsd) / fxRate).toFixed(2)}`;
  }, [amount, displayValue, fiat.symbol, fiatEntry, fxRate, unitDecimals, unitPriceUsd, unitSymbol]);

  const handleInputModeChange = (next: InputMode) => {
    setInputMode(next);
    setDisplayValue('');
    setAmount('');
  };

  const handleCryptoAmountChange = (val: string) => {
    const clean = val.replace(',', '.');
    setDisplayValue(clean);
    setAmount(clean);
  };

  const quickAmounts = [50, 100, 500, 1000];
  const exceedsBalance = isConnected && mode !== 'inkind' && parseFloat(amount) > 0 && parseFloat(payBalance) >= 0 && parseFloat(amount) > parseFloat(payBalance);
  const quoteText = isLoadingQuote ? '…' : parseFloat(quote) > 0 && parseFloat(quote) < 0.0001 ? parseFloat(quote).toFixed(8) : quote || '0';
  const modes: Array<{ key: 'buy' | 'sell' | 'inkind'; label: string }> = [
    { key: 'buy', label: t('trade.buyBtn') },
    { key: 'sell', label: t('trade.sellBtn') },
    { key: 'inkind', label: t('trade.inkindBtn') },
  ];
  const setPercent = (pct: number) => {
    const bal = parseFloat(payBalance);
    if (!bal || bal <= 0) return;
    const qty = pct === 100 ? payBalance : ((bal * pct) / 100).toFixed(unitDecimals);
    if (fiatEntry) setDisplayValue(((parseFloat(qty) * unitPriceUsd) / fxRate).toFixed(2));
    else handleCryptoAmountChange(qty);
  };

  return (
    <div className="w-full">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-x-14">
      <div className="text-center lg:col-start-1 lg:row-start-1 lg:pt-6 lg:text-left">
        <p className="g-eyebrow g-eyebrow-gold">{t('trade.instant')}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">{t('trade.title1')} {t('trade.title2')}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400 lg:mx-0 lg:text-base lg:leading-7">{t('landing.buyIntro')}</p>
        <div className="mt-4 flex justify-center lg:justify-start">
          <AddToWallet t={t} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[520px] lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <div>
        <MigrateToNewVault />
      </div>

      <div className="mt-6 flex items-center justify-center">
        <div className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1" role="tablist">
          {modes.map((m) => (
            <button
              aria-selected={mode === m.key}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === m.key ? 'bg-amber-400 text-black' : 'text-zinc-400 hover:text-white'}`}
              key={m.key}
              onClick={() => setMode(m.key)}
              role="tab"
              title={m.key === 'inkind' ? t('trade.inkindTitle') : undefined}
              type="button"
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'inkind' ? (
        <div className="g-card-elevated mt-6 p-5 sm:p-6">
          <WhaleDepositPanel address={props.address} isConnected={isConnected} openWallet={openWallet} t={t} />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {/* You pay */}
          <div className="g-card-elevated p-2">
            <div className="relative rounded-xl bg-white/[0.02] p-4 transition focus-within:bg-white/[0.04]">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{t('ui.token.pay')}</span>
                <span className="tnum">{t('ui.token.balance')}: {mode === 'sell' ? gblinBalance : inputBalance}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  className="tnum w-full min-w-0 bg-transparent text-3xl font-semibold text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 placeholder:text-zinc-600"
                  inputMode="decimal"
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    if (fiatEntry) setDisplayValue(val);
                    else handleCryptoAmountChange(val);
                  }}
                  placeholder="0"
                  type="text"
                  value={fiatEntry ? displayValue : amount}
                />
                {fiatEntry ? <span className="shrink-0 text-lg font-semibold text-zinc-500">{fiat.code}</span> : null}
                {mode === 'buy' ? (
                  <TokenPicker
                    address={props.address}
                    customAddress={customTokenAddress}
                    onSelect={(symbol) => setSelectedToken(symbol)}
                    selected={selectedToken}
                    setCustomAddress={setCustomTokenAddress}
                    t={t}
                  />
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 py-1.5 pl-1.5 pr-3 text-sm font-semibold text-amber-300">
                    <TokenGlyph symbol="GBLIN" />
                    GBLIN
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="tnum text-xs text-zinc-500">{countervalue()}</span>
                  {!isCustomToken && unitPriceUsd > 0 ? (
                    <button
                      className="rounded-md border border-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-zinc-400 transition hover:border-amber-500/40 hover:text-amber-300"
                      onClick={() => handleInputModeChange(inputMode === 'fiat' ? 'crypto' : 'fiat')}
                      type="button"
                    >
                      {inputMode === 'fiat'
                        ? t('ui.token.showToken').replace('{sym}', unitSymbol)
                        : t('ui.token.showFiat').replace('{cur}', fiat.code)}
                    </button>
                  ) : null}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {mode === 'buy' && fiatEntry
                    ? quickAmounts.map((q) => (
                        <button className="tnum rounded-md border border-white/[0.08] px-2 py-1 text-xs text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300" key={q} onClick={() => setDisplayValue(String(q))} type="button">
                          {fiat.symbol}{q}
                        </button>
                      ))
                    : null}
                  {mode === 'sell'
                    ? [25, 50, 100].map((q) => (
                        <button className="tnum rounded-md border border-white/[0.08] px-2 py-1 text-xs text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300" key={q} onClick={() => setPercent(q)} type="button">
                          {q}%
                        </button>
                      ))
                    : null}
                  {mode === 'buy' ? (
                    <button
                      className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                      onClick={() => {
                        // ETH keeps a sliver for gas; any other token can be spent whole.
                        const bal = parseFloat(payBalance) * (activeToken?.isNative ? 0.9999 : 1);
                        if (!bal || bal <= 0) return;
                        if (fiatEntry) setDisplayValue(((bal * unitPriceUsd) / fxRate).toFixed(2));
                        else handleCryptoAmountChange(bal.toFixed(unitDecimals));
                      }}
                      type="button"
                    >
                      Max
                    </button>
                  ) : null}
                </div>
              </div>
              {exceedsBalance ? (
                <p className="mt-2 text-[11px] font-semibold text-rose-300" role="alert">
                  {t('ui.token.exceedsBalance').replace('{bal}', payBalance).replace('{sym}', unitSymbol)}
                </p>
              ) : null}
            </div>

            <div className="relative flex justify-center">
              <span className="absolute -top-3 flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.1] bg-[#0b0b0b] text-zinc-400">
                <ArrowRight className="h-3.5 w-3.5 rotate-90" />
              </span>
            </div>

            {/* You receive */}
            <div className="mt-1 rounded-xl bg-white/[0.02] p-4">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{t('ui.token.receive')}</span>
                {onChainData?.nav ? <span className="tnum">NAV {onChainData.nav}</span> : null}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <p className={`tnum w-full min-w-0 truncate text-3xl font-semibold ${isLoadingQuote ? 'text-zinc-600' : 'text-white'}`}>{quoteText}</p>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 py-1.5 pl-1.5 pr-3 text-sm font-semibold text-amber-300">
                  <TokenGlyph symbol={mode === 'sell' ? 'ETH' : 'GBLIN'} />
                  {quoteAssetLabel || 'GBLIN'}
                </span>
              </div>
            </div>
          </div>

          {mode === 'sell' ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`g-card p-3 text-left transition ${redeemOption === 'eth' ? 'border-amber-500/40 bg-amber-500/[0.06]' : 'g-hover'} ${isEthRedeemBlocked ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={isEthRedeemBlocked}
                onClick={() => setRedeemOption('eth')}
                type="button"
              >
                <p className="text-xs text-zinc-500">{t('trade.redeemOption')}</p>
                <p className="mt-1 text-sm font-semibold text-white">ETH</p>
                {isEthRedeemBlocked ? <p className="mt-1 text-[11px] text-amber-300">{t('trade.oracleGuard.badge')}</p> : null}
              </button>
              <button className={`g-card p-3 text-left transition ${redeemOption === 'basket' ? 'border-amber-500/40 bg-amber-500/[0.06]' : 'g-hover'}`} onClick={() => setRedeemOption('basket')} type="button">
                <p className="text-xs text-zinc-500">{t('trade.redeemOption')}</p>
                <p className="mt-1 text-sm font-semibold text-white">cbBTC + ETH + USDC</p>
              </button>
              {muteLegs && muteLegs.length > 0 ? (
                <div className="col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-3 py-2" role="alert">
                  <p className="text-xs font-semibold text-amber-200">{t('trade.legGuard.title')}</p>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-400">{String(t('trade.legGuard.body')).replace('{names}', muteLegs.join(', '))}</p>
                </div>
              ) : null}
              {isEthRedeemBlocked && !(muteLegs && muteLegs.length > 0) ? (
                <div className="col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-3 py-2" role="status">
                  <p className="text-xs font-semibold text-amber-200">{t('trade.oracleGuard.title')}</p>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-400">{t('trade.oracleGuard.body')}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {isConnected ? (
            <button className="g-btn g-btn-primary h-12 w-full text-base" disabled={isTradeDisabled || exceedsBalance} onClick={executeTrade} type="button">
              {isTransacting ? t('trade.transacting') : mode === 'buy' ? t('trade.buyBtn') : t('trade.sellBtn')}
              {!isTransacting ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          ) : (
            <ConnectInline t={t} />
          )}
          <p className="text-center text-xs leading-5 text-zinc-500">{mode === 'buy' ? t('landing.ctaMicro') : t('landing.sellMicro')}</p>

          <details className="g-card group px-4 py-3 text-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between text-zinc-400">
              <span>{t('trade.slippage')} · {slippage.toFixed(1)}%</span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 flex items-center gap-3">
              <input className="gblin-slider w-full" max={5} min={0.1} onChange={(e) => setSlippage(Number(e.target.value))} step={0.1} type="range" value={slippage} />
              <span className="tnum w-12 text-right text-zinc-200">{slippage.toFixed(1)}%</span>
            </div>
            {mode === 'buy' ? (
              <a className="mt-3 block text-xs text-zinc-500 underline-offset-4 hover:text-amber-300 hover:underline" href="https://www.coinbase.com/how-to-buy/ethereum" rel="noreferrer" target="_blank">{t('trade.needEth')}</a>
            ) : null}
          </details>

          {tradeError ? <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{tradeError}</div> : null}
          {tradeTxHash ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <p className="font-semibold">{t('trade.success')}</p>
              <a className="mt-1 inline-flex items-center gap-2 text-emerald-200 hover:text-white" href={`https://basescan.org/tx/${tradeTxHash}`} rel="noreferrer" target="_blank">
                {t('trade.viewTx')}
                <ExternalLink className="h-4 w-4" />
              </a>
              <div className="mt-2">
                <AddToWallet className="inline-flex items-center gap-2 text-emerald-200 hover:text-white" t={t} />
              </div>
            </div>
          ) : null}
        </div>
      )}

      </div>

      <div className="lg:col-start-1 lg:row-start-2">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {[
          { title: t('trade.feature1Title'), body: t('trade.feature1Desc') },
          { title: t('trade.feature2Title'), body: t('trade.feature2Desc') },
          { title: t('yield.mechanismTitle'), body: t('yield.mechanismDesc') },
        ].map((item) => (
          <div className="g-card p-4" key={item.title}>
            <p className="text-sm font-semibold text-white">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">{item.body}</p>
          </div>
        ))}
      </div>
      {gblinPriceFiat > 0 ? (
        <p className="tnum mt-4 text-center text-xs text-zinc-500 lg:text-left">
          1 GBLIN ≈ {fiat.symbol}{gblinPriceFiat.toFixed(2)} {fiat.code} · 1 ETH ≈ {fiat.symbol}{ethPriceFiat.toFixed(0)} · {t('dashboard.navTitle')} {onChainData?.nav || '—'}
        </p>
      ) : null}
      </div>
      </div>

      <div className="mt-10">
        <MintVsPoolSection t={t} />
      </div>
    </div>
  );
}

export function RebalanceView(props: RebalanceViewProps) {
  const { t, rebalanceOverviewCards, autoRebalanceOpportunity, rebalanceBountyActive, rebalanceMinSwapRequiredEth, isArbitraging, isArbDisabled, executeArbitrage, arbError, arbTxHash, isConnected, openWallet, onChainData, eligibleRebalanceCount, isRebalancingAll, executeRebalanceAll, rebalanceAllProgress, rebalanceAllResults } = props;

  return (
    <div className="space-y-12">
      <section className={`${shellCard} p-7 sm:p-10`}>
        <SectionHeading body={t('rebalance.desc')} eyebrow={t('rebalance.badge')} title={t('rebalance.title')} />
      </section>

      {/* COMMUNITY REBALANCE INFO + HISTORY */}
      <CommunityRebalanceSection t={t} />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-4">
          {rebalanceOverviewCards.map((card) => (
            <div className={`${shellCard} ${card.containerClass} p-5`} key={card.name}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-semibold text-white">{card.name}</p>
                  <p className={`mt-2 inline-flex items-center gap-2 text-sm ${card.recommendationTone}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${card.recommendationDot}`} />
                    {card.recommendationText}
                  </p>
                  {card.weightGap !== null && card.weightGap < 1 && card.weightGap > 0 ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-300">
                      <span>⚠</span> {t('rebalance.gapTooSmall')} ({card.weightGap.toFixed(2)}%)
                    </p>
                  ) : null}
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-zinc-300">
                  {card.directionLabel}
                </div>
              </div>
              {/* Visual weight bar */}
              {card.actualWeight !== null && card.dynamicWeight !== null ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                    <span>{t('rebalance.actual')}</span>
                    <span>{formatWeight(card.actualWeight)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${Math.min(card.actualWeight, 100)}%`,
                        background: card.weightGap !== null && Math.abs(card.weightGap) > 3
                          ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                          : 'linear-gradient(90deg, #10b981, #34d399)'
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                    <span>{t('rebalance.dynamic')}</span>
                    <span>{formatWeight(card.dynamicWeight)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-blue-400/60 transition-[width] duration-700"
                      style={{ width: `${Math.min(card.dynamicWeight, 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('rebalance.actual')}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatWeight(card.actualWeight)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('rebalance.dynamic')}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatWeight(card.dynamicWeight)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('rebalance.base')}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatWeight(card.baseWeight)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:col-span-2 xl:col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{card.amountLabel}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{card.amountValue}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 xl:col-span-1">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{card.minFloorLabel}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{card.minFloorValue}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={`${shellCard} p-7 sm:p-8`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${rebalanceBountyActive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
              {rebalanceBountyActive ? t('rebalance.bountyReady') : t('rebalance.bountyLow')}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-zinc-300">
              {t('rebalance.selected')}: {autoRebalanceOpportunity?.name || '--'}
            </span>
          </div>

          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('rebalance.asset')}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{autoRebalanceOpportunity?.name || '--'}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('rebalance.direction')}</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {autoRebalanceOpportunity?.recommendation === 'weth-to-asset'
                    ? t('rebalance.directionToAsset')
                    : autoRebalanceOpportunity?.recommendation === 'asset-to-weth'
                      ? t('rebalance.directionToWeth')
                      : '--'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('rebalance.amount')}</p>
                <p className="mt-2 text-lg font-semibold text-white">{autoRebalanceOpportunity ? `${autoRebalanceOpportunity.inputAmountText} ${autoRebalanceOpportunity.inputSymbol}` : '--'}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('rebalance.minFloor')}</p>
                <p className="mt-2 text-lg font-semibold text-white">{formatTokenAmount(rebalanceMinSwapRequiredEth, 4)} WETH</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('site.managementFee')}</p>
                <p className="mt-2 text-lg font-semibold text-white">{((onChainData?.managementFeeBps ?? 0) / 100).toFixed(2)}% / year</p>
              </div>
            </div>
          </div>

          {/* Gas estimate preview */}
          {autoRebalanceOpportunity?.eligible ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <Zap className="h-4 w-4 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Gas Estimate</p>
                <p className="text-sm font-semibold text-emerald-300">~0.0001–0.0005 ETH · Adaptive bounty ≈ {Math.min(0.01, Math.max(0.00005, autoRebalanceOpportunity.targetEthAmount * 0.0005)).toFixed(5)} ETH</p>
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm leading-7 text-zinc-300">{t('rebalance.gasNotice')}</p>
            <p className="text-sm leading-7 text-zinc-300">{t('rebalance.floorNotice')}</p>
            <p className="text-sm leading-7 text-zinc-300">{t('rebalance.recommendationCounterparty')}</p>
          </div>

          {!isConnected ? (
            <a
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-3.5 text-sm font-bold uppercase tracking-[0.18em] text-black shadow-[0_0_24px_rgba(245,158,11,0.3)] transition-[background-color,box-shadow] hover:from-amber-400 hover:to-amber-300 hover:shadow-[0_0_36px_rgba(245,158,11,0.5)]"
              href="/account"
            >
              <Zap className="h-4 w-4" />
              {t('rebalance.connectWallet')} — GBLIN Hub
            </a>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${isArbDisabled ? 'cursor-not-allowed bg-zinc-800 text-zinc-500' : 'bg-amber-400 text-black hover:bg-amber-300'}`} disabled={isArbDisabled || isRebalancingAll} onClick={executeArbitrage} type="button">
                {isArbitraging ? (
                  <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />{t('rebalance.processing')}</span>
                ) : (
                  <><Zap className="h-4 w-4" />{t('rebalance.execute')}</>
                )}
              </button>
              <button
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${eligibleRebalanceCount < 2 || isRebalancingAll || isArbitraging ? 'cursor-not-allowed bg-zinc-800 text-zinc-500' : 'bg-gradient-to-r from-amber-400 to-amber-500 text-black hover:from-amber-300 hover:to-amber-400'}`}
                disabled={eligibleRebalanceCount < 2 || isRebalancingAll || isArbitraging}
                onClick={executeRebalanceAll}
                type="button"
              >
                {isRebalancingAll ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    {rebalanceAllProgress
                      ? `${rebalanceAllProgress.currentAsset} (${rebalanceAllProgress.current}/${rebalanceAllProgress.total})`
                      : t('rebalance.processing')}
                  </span>
                ) : (
                  <><Zap className="h-4 w-4" />{t('rebalance.executeAll')} ({eligibleRebalanceCount})</>
                )}
              </button>
            </div>
          )}
          
          {/* Animated progress bar for Rebalance All */}
          {isRebalancingAll && rebalanceAllProgress ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Rebalancing {rebalanceAllProgress.currentAsset}…</span>
                <span>{rebalanceAllProgress.current}/{rebalanceAllProgress.total}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-[width] duration-500"
                  style={{ width: `${(rebalanceAllProgress.current / rebalanceAllProgress.total) * 100}%` }}
                />
              </div>
            </div>
          ) : null}

          {arbError ? <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{arbError}</div> : null}
          {arbTxHash ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
              <p className="font-semibold">{t('rebalance.txSuccess')}</p>
              <a className="mt-2 inline-flex items-center gap-2 text-emerald-200 hover:text-white" href={`https://basescan.org/tx/${arbTxHash}`} rel="noreferrer" target="_blank">
                {t('trade.viewTx')}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ) : null}

          {rebalanceAllResults.length > 0 ? (
            <div className="mt-4 space-y-2">
              {rebalanceAllResults.map((result, i) => (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${result.success ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/20 bg-rose-500/10 text-rose-200'}`}
                  key={`${result.name}-${i}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{result.name}</span>
                    <span>{result.success ? '✓' : '✗'}</span>
                  </div>
                  {result.success && result.hash ? (
                    <a className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-200 hover:text-white" href={`https://basescan.org/tx/${result.hash}`} rel="noreferrer" target="_blank">
                      {result.hash.slice(0, 10)}...{result.hash.slice(-6)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {!result.success && result.error ? <p className="mt-1 text-xs">{result.error}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

    </div>
  );
}

function CommunityRebalanceSection({ t }: { t: (key: string) => string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // The route reports `degraded` when it could not read the logs. In that case an empty list
  // does not mean "no rebalances happened", and must not be presented as if it did.
  const [blind, setBlind] = useState(false);

  useEffect(() => {
    fetch('/api/rebalance-history')
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.events || []);
        setBlind(Boolean(data.degraded));
        setLoading(false);
      })
      .catch(() => {
        setBlind(true);
        setLoading(false);
      });
  }, []);

  return (
    <section className="space-y-6">
      {/* Community info banner */}
      <div className={`${shellCard} overflow-hidden`}>
        <div className="border-b border-amber-500/20 bg-gradient-to-r from-amber-500/[0.08] to-transparent p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">{t('rebalance.communityTitle')}</h3>
              <p className="mt-2 text-sm leading-7 text-zinc-400">{t('rebalance.communityDesc')}</p>
            </div>
          </div>
        </div>
        <div className="grid gap-px bg-white/5 sm:grid-cols-3">
          <div className="bg-[#0A0A0A] p-5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-400/70">Reward</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">{t('rebalance.communityReward')}</p>
          </div>
          <div className="bg-[#0A0A0A] p-5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-blue-400/70">Schedule</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">{t('rebalance.communityBotSchedule')}</p>
          </div>
          <div className="bg-[#0A0A0A] p-5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-400/70">Challenge</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-amber-300">{t('rebalance.communityCallToAction')}</p>
          </div>
        </div>
      </div>

      {/* Rebalance history table */}
      <div className={`${shellCard} p-6 sm:p-8`}>
        <div className="flex items-center gap-3 mb-6">
          <Activity className="h-5 w-5 text-zinc-400" />
          <h3 className="text-lg font-semibold text-white">{t('rebalance.historyTitle')}</h3>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">{t('rebalance.historyLoading')}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {t(blind ? 'rebalance.historyUnavailable' : 'rebalance.historyEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                  <th className="pb-3 pr-4 text-left font-medium">{t('rebalance.historyDate')}</th>
                  <th className="pb-3 pr-4 text-left font-medium">{t('rebalance.historyAsset')}</th>
                  <th className="pb-3 pr-4 text-left font-medium">{t('rebalance.historyExecutor')}</th>
                  <th className="pb-3 text-left font-medium">{t('rebalance.historyTx')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((event: any, i: number) => (
                  <tr key={`${event.txHash}-${i}`} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-4 text-zinc-400">
                      {event.date ? new Date(event.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '--'}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-white">
                          {event.tokenIn} <ArrowRight className="h-3 w-3 text-zinc-500" /> {event.tokenOut}
                        </span>
                        {/* Which deployment executed it. Rebalances predating the
                            migration stay visible and are labelled, rather than
                            hidden or passed off as current-contract activity. */}
                        {event.contract && (
                          <span
                            title={event.contractAddress}
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wide ${
                              event.isCurrentContract === false
                                ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300/90'
                                : 'border border-white/10 bg-white/5 text-zinc-400'
                            }`}
                          >
                            {event.contract}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-zinc-500">
                      {event.executor ? `${event.executor.slice(0, 6)}...${event.executor.slice(-4)}` : '--'}
                    </td>
                    <td className="py-3">
                      <a
                        href={`https://basescan.org/tx/${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        {event.txHash ? `${event.txHash.slice(0, 8)}...` : '--'}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function VaultView(props: VaultViewProps) {
  const { t, basketData, onChainData } = props;

  return (
    <div className="space-y-12">
      <section className={`${shellCard} p-7 sm:p-10`}>
        <SectionHeading body={t('vault.desc')} eyebrow={t('vault.core')} title={t('vault.title')} />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {basketData.map((asset) => (
            <BasketCard asset={asset} key={asset.address} t={t} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className={`${shellCard} p-7 sm:p-8`}>
          <p className="text-[11px] uppercase tracking-[0.38em] text-zinc-500">{t('site.treasuryArchitecture')}</p>
          <div className="mt-6 space-y-4">
            {[
              { title: t('core.point1'), body: t('core.desc') },
              { title: t('yield.accumulationTitle'), body: t('yield.accumulationDesc') },
              { title: t('yield.actionTitle'), body: t('yield.actionDesc') }
            ].map((item) => (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5" key={item.title}>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-zinc-300">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={`${shellCard} p-7 sm:p-8`}>
          <p className="text-[11px] uppercase tracking-[0.38em] text-zinc-500">{t('site.protectedReserves')}</p>
          {/* Headline figure: total value redistributed to every holder. */}
          <div className="mt-6 rounded-[24px] border border-amber-500/30 bg-amber-500/[0.06] p-6 sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/80">{t('dashboard.totalYieldTitle')}</p>
            <p className="mt-3 font-serif text-4xl sm:text-5xl xl:text-6xl font-semibold leading-none text-amber-300 break-words">{onChainData?.totalYieldDistributed == null ? '—' : `${formatTokenAmount(onChainData.totalYieldDistributed, 6)} WETH`}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{t('yield.automationDesc')}</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <MetricCard hint={t('site.managementFeeHint')} label={t('site.managementFee')} value={`${((onChainData?.managementFeeBps ?? 0) / 100).toFixed(2)}% / year`} />
            <MetricCard hint="Treasury net asset value" label={t('dashboard.navTitle')} value={onChainData?.nav || '$0.00'} />
          </div>
        </div>
      </section>
    </div>
  );
}
