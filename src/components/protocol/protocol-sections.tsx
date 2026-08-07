/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Activity, ArrowRight, Copy, Download, ExternalLink, Landmark, RefreshCw, Shield, TrendingUp, Wallet, Zap, Lock } from 'lucide-react';
import type { BasketItem, DashboardData, OnChainData, OracleHealth, TransactionItem } from './protocol-data';
import { CONTRACT_ADDRESS, DISPLAY_CONTRACT_ADDRESS, formatCurrency, formatTokenAmount, shortenAddress, WHITEPAPER_URL } from './protocol-data';
import { WhaleDepositPanel } from './whale-deposit-panel';
import MigrateButton from "@/components/MigrateButton";
import { ProofSection, FeeEngineSection } from './proof-section';
import { NavFeesHeroLedger } from './nav-fees';

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
  minSwapRequiredEth: number;
}

interface SharedViewProps {
  t: (key: string) => string;
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

const shellCard = 'rounded-[2rem] border border-white/10 bg-[#0A0A0A]/90 shadow-[0_30px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl';

const sectionTitle = 'font-serif text-[clamp(2rem,5vw,3.5rem)] tracking-tight text-white';
const sectionBody = 'max-w-2xl text-sm leading-7 text-white/60 sm:text-base';

function formatWeight(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '--';
  return `${value.toFixed(2)}%`;
}

function formatDateLabel(timestamp: number) {
  if (!timestamp) return '--';
  return new Date(timestamp * 1000).toLocaleString();
}

function MetricCard({ label, value, hint, loading }: { label: string; value: string; hint?: string; loading?: boolean }) {
  return (
    <div className={`${shellCard} relative overflow-hidden p-5`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute -right-8 -top-12 h-28 w-28 rounded-full bg-amber-400/10 blur-3xl" />
      <p className="relative text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">{label}</p>
      <p className="relative mt-4 font-serif text-3xl leading-none tracking-tight text-white sm:text-[2.35rem]">{loading ? '...' : value}</p>
      {hint ? <p className="relative mt-3 text-sm text-white/55">{hint}</p> : null}
    </div>
  );
}

function HighlightCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className={`${shellCard} relative overflow-hidden p-6`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_30%)]" />
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10 text-amber-200">
        {icon}
      </div>
      <p className="relative mt-5 font-serif text-[1.35rem] tracking-tight text-white">{title}</p>
      <p className="relative mt-3 text-sm leading-7 text-white/60">{body}</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title, body, actions }: { eyebrow?: string; title: string; body?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="text-[10px] font-mono uppercase tracking-[0.32em] text-amber-300/80">{eyebrow}</p> : null}
        <h2 className={`mt-3 ${sectionTitle}`}>{title}</h2>
        {body ? <p className={`mt-4 ${sectionBody}`}>{body}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

function BasketCard({ asset }: { asset: BasketItem }) {
  return (
    <div className={`${shellCard} h-full p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-serif text-lg tracking-tight text-white sm:text-xl">{asset.name}</p>
          <p className="mt-1 truncate text-xs text-zinc-400">{shortenAddress(asset.address)}</p>
        </div>
        <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-300">
          {formatWeight(asset.realWeight)}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2.5">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">TVL</p>
          <p className="mt-2 break-words text-sm font-semibold leading-tight text-white sm:text-base">{formatCurrency(asset.tvl)}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Price</p>
          <p className="mt-2 break-words text-sm font-semibold leading-tight text-white sm:text-base">{formatCurrency(asset.price, 2)}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Dynamic</p>
          <p className="mt-2 break-words text-sm font-semibold leading-tight text-white sm:text-base">{formatWeight(asset.dynamicWeight / 100)}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Base</p>
          <p className="mt-2 break-words text-sm font-semibold leading-tight text-white sm:text-base">{formatWeight(asset.baseWeight / 100)}</p>
        </div>
      </div>
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
          <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.22em] text-zinc-500">
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
      .then((data: { total_paid_calls?: number; total_unique_agents?: number }) => {
        if (cancelled) return;
        const calls = Number(data?.total_paid_calls ?? 0);
        const agents = Number(data?.total_unique_agents ?? 0);
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
      className="group mt-4 block rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/[0.04] p-6 transition hover:border-emerald-500/40 hover:bg-emerald-500/[0.07] sm:p-7"
      href="/observatory"
    >
      {/* items-start keeps the dot on the first line when the label wraps on mobile. */}
      <div className="flex items-start gap-2">
        <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-emerald-400/80">{t('landing.agentsEyebrow')}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="font-serif text-[clamp(1.9rem,7vw,2.6rem)] leading-none tracking-tight text-white">
            {stats.agents.toLocaleString('en-US')}
          </p>
          <p className="mt-2 text-[11px] leading-5 text-zinc-400">{t('landing.agentsUnique')}</p>
        </div>
        <div>
          <p className="font-serif text-[clamp(1.9rem,7vw,2.6rem)] leading-none tracking-tight text-white">
            {stats.calls.toLocaleString('en-US')}
          </p>
          <p className="mt-2 text-[11px] leading-5 text-zinc-400">{t('landing.agentsCalls')}</p>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-5 text-zinc-500">{t('landing.agentsHint')}</p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300/80 transition group-hover:text-emerald-200">
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
    <section className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.05] via-[#080808] to-[#080808]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
      <div className="p-6 sm:p-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-emerald-400/70 mb-2">{t('landing.mvpEyebrow')}</p>
        <h2 className="font-serif text-2xl sm:text-3xl tracking-tight text-white mb-3">{t('landing.mvpTitle')}</h2>
        <p className="max-w-2xl text-sm leading-7 text-white/50 mb-6">{t('landing.mvpIntro')}</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
                <th className="pb-3 pr-4 font-normal">{t('landing.mvpColSize')}</th>
                <th className="pb-3 pr-4 font-normal text-emerald-400/80">{t('landing.mvpColMint')}</th>
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
                      <td className="py-4 pr-4 font-mono text-sm text-emerald-300">
                        {formatCurrency(row.mintUsd, 2)}
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-500/60">/ token</span>
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

        {/* The DEX routes, kept honest and kept second. */}
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="text-sm font-semibold text-white">{t('landing.mvpPoolsTitle')}</p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/50">{t('landing.mvpPoolsBody')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 transition hover:border-white/20 hover:text-white"
              href="https://aerodrome.finance/swap?from=eth&to=0x36C81d7E1966310F305eA637e761Cf77F90852f0&chain0=8453&chain1=8453"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t('landing.mvpAero')} <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 transition hover:border-white/20 hover:text-white"
              href="https://app.uniswap.org/explore/pools/base/0xAb305c45F4E42A73909a49a6775e3f7782239dAE"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t('landing.mvpUni')} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="mt-4 text-[11px] leading-6 text-zinc-600">{t('hero.uniswapBotNote')}</p>
        </div>
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
    <section className="rounded-2xl border border-white/[0.07] bg-[#080808] p-6 sm:p-8">
      <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600 mb-2">{t('landing.sizeEyebrow')}</p>
      <h2 className="font-serif text-2xl sm:text-3xl tracking-tight text-white mb-3 max-w-2xl">{t('landing.sizeTitle')}</h2>
      <p className="max-w-3xl text-sm leading-7 text-white/50">
        {t('landing.sizeBodyA')} <span className="font-semibold text-white">{tvl}</span>{t('landing.sizeBodyB')}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 transition hover:border-white/20 hover:text-white"
          href={`https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t('landing.sizeCta')} <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 transition hover:border-white/20 hover:text-white"
          href={`https://basescan.org/token/${DISPLAY_CONTRACT_ADDRESS}#balances`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t('landing.sizeHolders')} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </section>
  );
}

export function HomeView(props: HomeViewProps) {
  const { t, onChainData, basketData, lastYieldDistribution, discountPercentage, isMarketLoading, isOnChainLoading, isConnected, address, openWallet, disconnectWallet, copyContract, copied } = props;

  return (
    <div className="space-y-5 sm:space-y-6">

      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#080808] p-7 sm:p-10 lg:p-14">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,rgba(245,158,11,0.13),transparent)]" />
        <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-amber-500/10 blur-[80px]" />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-amber-500/5 blur-[60px]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
        <div className="relative grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                {t('dashboard.verified')}
              </div>
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600 mb-3">{t('site.brandSubtitle')}</p>
            <h1 className="font-serif text-[clamp(2.3rem,6.5vw,4.4rem)] leading-[0.98] tracking-tight text-white">
              {t('landing.h1a')}{' '}
              <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text italic text-transparent">
                {t('landing.h1b')}
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/55 sm:text-lg">{t('landing.sub')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="group inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-7 py-4 text-[11px] font-bold uppercase tracking-[0.22em] text-black transition hover:bg-amber-400 hover:-translate-y-0.5 shadow-[0_0_30px_rgba(245,158,11,0.25)]"
                href="/buy-gblin"
              >
                {t('landing.cta')}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-transparent px-5 py-4 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400 transition hover:border-amber-500/25 hover:text-amber-300"
                href="/vault"
              >
                {t('landing.ctaSecondary')}
              </Link>
            </div>
            <p className="mt-3 text-xs leading-6 text-zinc-500">{t('landing.ctaMicro')}</p>

            {/* Verifiable proof strip — every item is a link someone can re-read on Base. */}
            <div className="mt-7 flex flex-wrap items-center gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2 text-[11px] font-mono text-zinc-500 transition hover:border-amber-500/20 hover:text-amber-300"
                onClick={copyContract}
                type="button"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? t('site.copied') : shortenAddress(DISPLAY_CONTRACT_ADDRESS)}
              </button>
              <a
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2 text-[11px] font-mono text-zinc-500 transition hover:border-amber-500/20 hover:text-amber-300"
                href={`https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}#readContract`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t('landing.proofVerify')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* One live stat, and what stands behind it. */}
          <div className="w-full min-w-0 xl:w-[400px]">
            <div className="rounded-[1.75rem] border border-amber-500/20 bg-amber-500/[0.04] p-6 sm:p-8">
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-400/70">{t('landing.navLabel')}</p>
              <p className={`mt-3 font-serif text-[clamp(2.4rem,9vw,3.6rem)] leading-none tracking-tight text-white ${isOnChainLoading ? 'animate-pulse opacity-50' : ''} break-words`}>
                {isOnChainLoading ? '...' : (onChainData?.nav || '—')}
              </p>
              <p className="mt-3 text-[11px] leading-5 text-zinc-500">{t('landing.navHint')}</p>

              {/* Taken from holders, next to given back — the fee ledger, live. */}
              <NavFeesHeroLedger t={t} />

              <div className="mt-6 border-t border-white/[0.07] pt-5">
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">{t('landing.backedBy')}</p>
                {basketData.length > 0 ? (
                  <>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                      {basketData.map((asset, i) => (
                        <div
                          key={asset.address}
                          className={i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-sky-400' : 'bg-emerald-400'}
                          style={{ width: `${Math.max(asset.realWeight, 0)}%` }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {basketData.map((asset, i) => (
                        <div className="flex items-center justify-between text-xs" key={asset.address}>
                          <span className="flex items-center gap-2 text-zinc-400">
                            <span className={`h-2 w-2 rounded-full ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-sky-400' : 'bg-emerald-400'}`} />
                            {asset.name}
                          </span>
                          <span className="font-mono text-zinc-500">{formatWeight(asset.realWeight)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="h-2.5 w-full animate-pulse rounded-full bg-white/5" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
                  </div>
                )}
              </div>
            </div>

            {/* Self-hides until real counts arrive. */}
            <AgentPulse t={t} />
          </div>
        </div>
      </section>

      {/* ── APPRECIATION ENGINE: the 0.05% → treasury fee, explained ── */}
      <FeeEngineSection t={t} />

      {/* ── WHAT YOU ACTUALLY PAY: mint vs pool, live from Base ── */}
      <MintVsPoolSection t={t} />

      {/* VAULT BASKET + YIELD */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
        <div className="rounded-2xl border border-white/[0.07] bg-[#080808] p-6 sm:p-8">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400/70 mb-2">{t('vault.core')}</p>
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight text-white mb-2">{t('vault.title')}</h2>
          <p className="text-sm text-white/40 mb-6 max-w-lg">{t('vault.desc')}</p>
          {basketData.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {basketData.map((asset) => (
                <BasketCard asset={asset} key={asset.address} />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {['cbBTC', 'WETH', 'USDC'].map(name => (
                <div key={name} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 animate-pulse">
                  <p className="font-serif text-lg text-white/30">{name}</p>
                  <div className="mt-3 space-y-2">
                    <div className="h-3 bg-white/5 rounded" />
                    <div className="h-3 bg-white/5 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-[#080808] p-6 sm:p-8">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400/70 mb-2">{t('yield.title')}</p>
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight text-white mb-2">{t('core.architectureTitle')}</h2>
          <p className="text-sm text-white/40 mb-6">{t('yield.desc')}</p>
          <div className="space-y-3">
            {[
              { icon: <RefreshCw className="h-4 w-4" />, title: t('yield.step1Title'), body: t('yield.step1Desc') },
              { icon: <TrendingUp className="h-4 w-4" />, title: t('yield.step2Title'), body: t('yield.step2Desc') },
              { icon: <Lock className="h-4 w-4" />, title: t('yield.step3Title'), body: t('yield.step3Desc') },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-amber-500/15 transition-colors">
                <div className="shrink-0 h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-6 text-zinc-500">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW BIG THIS IS: the vault's own size, stated first ── */}
      <VaultSizeSection t={t} onChainData={onChainData} />

      {/* ── SIMULATED 10y backtest of the live shield logic — below the live facts ── */}
      <ProofSection t={t} />


      {/* SECURITY & TRANSPARENCY */}
      <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] to-[#080808] overflow-hidden">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400/70">{t('security.eyebrow') || 'Transparency is our Infrastructure'}</p>
              <h2 className="font-serif text-2xl sm:text-3xl tracking-tight text-white">{t('security.title') || 'Security & Transparency'}</h2>
            </div>
          </div>

          {/* Story Text */}
          <div className="mb-8 p-5 rounded-2xl border border-white/[0.07] bg-white/[0.02]">
            <p className="text-sm leading-7 text-white/60 mb-4">{t('security.story1') || 'At GBLIN, we believe security is built by addressing problems in broad daylight. Before launching our definitive version (V6), white-hat research and multiple independent security reviews identified critical vulnerabilities — including a "Silent Catch" and a Path Spoofing vector.'}</p>
            <p className="text-sm leading-7 text-white/60">{t('security.story2') || 'Unlike the crypto standard, we did not hide them. We rebuilt the engine from scratch and hardened it again for V6 — adaptive slippage, Chainlink min/max-answer bounds, and a fully parametric, hard-capped design. The GBLIN V6 infrastructure today guarantees rigorous mathematical protection for your capital.'}</p>
          </div>
          
          {/* Security Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* Delta-Balance Card */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 hover:border-emerald-500/20 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Lock className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-white">{t('security.deltaBalanceTitle') || 'Rigorous Delta-Balance'}</p>
              </div>
              <p className="text-xs leading-6 text-zinc-500 mb-3">{t('security.deltaBalanceDesc') || 'The contract performs precise mathematical checks to prevent any liquidity drainage attacks. Every transaction validates total assets ≥ liabilities.'}</p>
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.05] px-3 py-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/70">{t('security.mathProtection') || 'Math protection'}</p>
              </div>
            </div>

            {/* Slippage Protection Card */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 hover:border-emerald-500/20 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Shield className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-white">{t('security.slippageTitle') || 'Adaptive Slippage Protection'}</p>
              </div>
              <p className="text-xs leading-6 text-zinc-500 mb-3">{t('security.slippageDesc') || 'We eliminated "silent try/catch" on critical swaps. Internal swaps use an adaptive slippage envelope (0.5%–5.5%) driven by on-chain volatility, under an immutable 20% hard cap; if a swap can\'t meet its minimum, the contract reverts. Funds are 100% protected.'}</p>
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.05] px-3 py-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/70">{t('security.noSilentFail') || 'No silent fails'}</p>
              </div>
            </div>

            {/* Open Source Card */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 hover:border-emerald-500/20 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <ExternalLink className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-white">{t('security.openSourceTitle') || 'Zero Pre-Mint & Open Source'}</p>
              </div>
              <p className="text-xs leading-6 text-zinc-500 mb-3">{t('security.openSourceDesc') || 'No hidden allocations. The code is fully open-source and verified on BaseScan. Complete transparency from day one.'}</p>
              <a 
                href={`https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-2 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/[0.12]"
              >
                <ExternalLink className="h-3 w-3" />
                {t('security.viewOnBasescan') || 'View on BaseScan'}
              </a>
            </div>

            {/* Bug Bounty Card */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5 hover:border-amber-500/40 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <Zap className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-white">{t('security.bugBountyTitle') || '$50 Math Challenge'}</p>
              </div>
              <p className="text-xs leading-6 text-zinc-500 mb-3">{t('security.bugBountyDesc') || 'We are so confident in our "Dynamic Volume Floor" rebalancing model that we have a $50 Bug Bounty permanently open for anyone who can break the protocol mathematics.'}</p>
              <a 
                href="https://github.com/gblinproject/GBLIN-Protocol/tree/main/challenge"
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.1] px-3 py-2 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/[0.15]"
              >
                <ExternalLink className="h-3 w-3" />
                {t('security.viewBounty') || 'See the challenge'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section className="grid gap-3 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:border-amber-500/20 transition-all group">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 mb-4 group-hover:scale-110 transition-transform">
            <Landmark className="h-5 w-5" />
          </div>
          <p className="font-serif text-lg tracking-tight text-white mb-2">{t('core.bankTitle')}</p>
          <p className="text-sm leading-7 text-white/50">{t('core.bankDesc')}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6 hover:border-amber-500/40 transition-all group">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-300 mb-4 group-hover:scale-110 transition-transform">
            <Shield className="h-5 w-5" />
          </div>
          <p className="font-serif text-lg tracking-tight text-white mb-2">{t('core.crashShieldTitle')}</p>
          <p className="text-sm leading-7 text-white/50">{t('core.crashShieldDesc')}</p>
          <p className="mt-2 text-[11px] leading-5 text-amber-400/60">{t('core.crashShieldBotNote')}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:border-amber-500/20 transition-all group">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 mb-4 group-hover:scale-110 transition-transform">
            <TrendingUp className="h-5 w-5" />
          </div>
          <p className="font-serif text-lg tracking-tight text-white mb-2">{t('core.appreciationTitle')}</p>
          <p className="text-sm leading-7 text-white/50">{t('core.appreciationDesc')}</p>
        </div>
      </section>

      {/* DEFILLAMA TRACKED */}
      <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] to-[#080808] overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <a 
              href="https://defillama.com/protocol/tvl/global-balanced-liquidity-index" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-4"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 transition group-hover:scale-105">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400/70">{t('defillama.trackedOn') || 'Tracked on DefiLlama'}</p>
                <p className="text-lg font-semibold text-white group-hover:text-emerald-300 transition-colors">Global Balanced Liquidity Index</p>
              </div>
            </a>
            <div className="flex-1 md:border-l md:border-white/[0.1] md:pl-6">
              <p className="text-sm leading-7 text-white/50">{t('defillama.desc') || 'GBLIN is officially tracked as an autonomous Index Protocol on Base network, classified alongside industry leaders like Index Coop and Reserve. No pre-set templates—just pure on-chain transparent and verifiable infrastructure.'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* PROTOCOL SNAPSHOT */}
      <section className="rounded-2xl border border-white/[0.07] bg-[#080808] overflow-hidden">
        <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600 mb-3">{t('site.protocolSnapshotEyebrow')}</p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight text-white mb-3">{t('site.protocolSnapshotTitle')}</h2>
            <p className="text-sm leading-7 text-white/50 max-w-lg mb-6">{t('dashboard.protocolDesc')}</p>
            <div className="flex flex-wrap gap-3">
              <Link className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.07] border border-white/[0.1] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white transition hover:bg-white/[0.12] hover:-translate-y-0.5" href="/rebalance">
                {t('nav.rebalance')} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300 transition hover:bg-amber-500/[0.12] hover:-translate-y-0.5" href={WHITEPAPER_URL} rel="noreferrer" target="_blank">
                <Download className="h-3.5 w-3.5" /> {t('site.whitepaper')}
              </a>
              <a className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.06] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 transition hover:border-white/[0.12] hover:text-zinc-300" href={`https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}`} rel="noreferrer" target="_blank">
                <ExternalLink className="h-3.5 w-3.5" /> {t('site.basescan')}
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t('site.discountPremium'), value: `${discountPercentage.toFixed(2)}%`, hint: t('site.marketVsNav') },
              { label: t('site.lastYield'), value: formatDateLabel(lastYieldDistribution), hint: t('site.recentContractCycle') },
              { label: t('site.stabilityFund'), value: `${formatTokenAmount(Number(onChainData?.stabilityFund || 0), 4)} WETH`, hint: 'Liquidity backstop' },
              { label: 'Wallet', value: isConnected && address ? shortenAddress(address) : t('site.notConnected'), hint: t('site.connectedOperator') },
            ].map(m => (
              <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-2">{m.label}</p>
                <p className="font-serif text-xl text-white leading-tight">{m.value}</p>
                <p className="mt-1 text-[10px] text-zinc-600">{m.hint}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/[0.05] grid gap-4 p-6 sm:p-8 sm:grid-cols-2">
          <WalletPanel address={address} disconnectWallet={disconnectWallet} isConnected={isConnected} openWallet={openWallet} t={t} />
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600 mb-2">{t('site.research')}</p>
            <p className="text-base font-semibold text-white mb-2">{t('site.researchTitle')}</p>
            <p className="text-sm leading-7 text-zinc-500">{t('yield.mechanismDesc')}</p>
          </div>
        </div>
      </section>

      {/* Mobile keeps the one action within thumb reach at every scroll depth. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 sm:hidden">
        <Link
          className="pointer-events-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-4 text-[12px] font-bold uppercase tracking-[0.2em] text-black shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
          href="/buy-gblin"
        >
          {t('landing.cta')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="h-16 sm:hidden" aria-hidden="true" />
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
        {/* HERO — quanto è stato redistribuito a TUTTI i holder: il nostro punto di forza */}
        <div className="mt-4 rounded-[24px] border border-amber-500/30 bg-amber-500/[0.06] p-6 sm:p-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-amber-300/80">{t('dashboard.totalYieldTitle')}</p>
            <p className="mt-2 font-serif text-4xl sm:text-5xl xl:text-6xl font-semibold leading-none text-amber-300 break-words">{formatTokenAmount(onChainData?.totalYieldDistributed || 0, 6)} WETH</p>
          </div>
          <p className="max-w-md text-sm leading-6 text-zinc-300">{t('dashboard.totalYieldDesc')}</p>
        </div>
      </section>

      <section>
        <SectionHeading body={t('vault.desc')} eyebrow={t('core.radarTitle')} title={t('dashboard.assetsInVault')} />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {basketData.map((asset) => (
            <BasketCard asset={asset} key={asset.address} />
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
            {/* HERO — redistribuito a TUTTI i holder (yield che entra nel NAV) */}
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/80">{t('dashboard.totalYieldTitle')}</p>
              <p className="mt-2 font-serif text-3xl sm:text-4xl font-semibold leading-none text-amber-300 break-words">{formatTokenAmount(onChainData?.totalYieldDistributed || 0, 6)} WETH</p>
              <p className="mt-2 text-[11px] leading-5 text-zinc-400">{t('dashboard.totalYieldDesc')}</p>
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('site.stabilityFund')}</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatTokenAmount(Number(onChainData?.stabilityFund || 0), 8)} WETH</p>
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

export function BuyView(props: BuyViewProps) {
  const { t, mode, setMode, amount, setAmount, slippage, setSlippage, quote, usdValue, isLoadingQuote, isTransacting, isTradeDisabled, executeTrade, tradeError, tradeTxHash, ethBalance, gblinBalance, inputBalance, isConnected, openWallet, marketData, onChainData, buyTokenOptions, customTokenAddress, quoteAssetLabel, redeemOption, isEthRedeemBlocked, oracleHealth, resolvedTokenSymbol, selectedToken, setCustomTokenAddress, setRedeemOption, setSelectedToken, tokenBalance } = props;

  // Detect language from <html lang> attribute (set by ProtocolShell) — lazy init avoids extra render
  const [detectedLang] = useState<string>(() => {
    if (typeof document === 'undefined') return 'en';
    const lang = document.documentElement.lang?.slice(0, 2) || 'en';
    return lang in FIAT_CONFIG ? lang : 'en';
  });

  const fiat = FIAT_CONFIG[detectedLang] ?? FIAT_CONFIG.en;

  const [inputMode, setInputMode] = useState<InputMode>('fiat');
  const [displayValue, setDisplayValue] = useState('');

  const ethPrice = marketData?.ethPriceUsd || 3500;
  const gblinPriceUsd = marketData?.priceUsd || 0;
  const fxRate = FX_TO_USD[fiat.code] ?? 1;                // fiat → USD
  const gblinPriceFiat = gblinPriceUsd / fxRate;            // GBLIN in fiat
  const ethPriceFiat = ethPrice / fxRate;                   // ETH in fiat

  // When inputMode or displayValue changes, convert to ETH and push into amount
  const convertToEth = useCallback((raw: string, im: InputMode): string => {
    const n = parseFloat(raw.replace(',', '.'));
    if (!raw || isNaN(n) || n <= 0) return '';
    if (im === 'crypto') return raw.replace(',', '.');
    if (im === 'fiat') {
      // fiat → USD → ETH
      const usd = n * fxRate;
      return (usd / ethPrice).toFixed(6);
    }
    // gblin → USD → ETH
    if (gblinPriceUsd <= 0) return '';
    const usd = n * gblinPriceUsd;
    return (usd / ethPrice).toFixed(6);
  }, [ethPrice, fxRate, gblinPriceUsd]);

  useEffect(() => {
    if (mode !== 'buy' || inputMode === 'crypto') return;
    const ethVal = convertToEth(displayValue, inputMode);
    setAmount(ethVal);
  }, [displayValue, inputMode, mode, convertToEth, setAmount]);

  // Countervalue line shown under the input
  const countervalue = useCallback((): string => {
    const n = parseFloat(displayValue.replace(',', '.'));
    if (!displayValue || isNaN(n) || n <= 0) return '';
    if (inputMode === 'fiat') {
      const usd = n * fxRate;
      const ethVal = usd / ethPrice;
      const gblinEst = gblinPriceUsd > 0 ? (usd / gblinPriceUsd).toFixed(6) : '—';
      return `≈ ${ethVal.toFixed(5)} ETH · ≈ ${gblinEst} GBLIN`;
    }
    if (inputMode === 'gblin') {
      const usd = n * gblinPriceUsd;
      const fiatVal = (usd / fxRate).toFixed(2);
      const ethVal = (usd / ethPrice).toFixed(5);
      return `≈ ${fiat.symbol}${fiatVal} · ≈ ${ethVal} ETH`;
    }
    // crypto mode — show fiat equivalent
    const usd = n * ethPrice;
    const fiatVal = (usd / fxRate).toFixed(2);
    const gblinEst = gblinPriceUsd > 0 ? (usd / gblinPriceUsd).toFixed(6) : '—';
    return `≈ ${fiat.symbol}${fiatVal} · ≈ ${gblinEst} GBLIN`;
  }, [displayValue, inputMode, ethPrice, fxRate, gblinPriceUsd, fiat]);

  // When switching to crypto mode sync displayValue ↔ amount
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

  const inputLabel: Record<InputMode, string> = {
    fiat: `${t('trade.amount')} (${fiat.code})`,
    gblin: `${t('trade.amount')} (GBLIN)`,
    crypto: `${t('trade.amount')} (ETH)`,
  };

  const inputPlaceholder: Record<InputMode, string> = {
    fiat: `0.00 ${fiat.symbol}`,
    gblin: '0.0000 GBLIN',
    crypto: '0.000000 ETH',
  };

  const inputSuffix: Record<InputMode, string> = {
    fiat: fiat.code,
    gblin: 'GBLIN',
    crypto: resolvedTokenSymbol,
  };

  return (
    <div className="space-y-8">
      {/* The page's own claim, put where the money is about to move. */}
      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] px-6 py-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-emerald-400/70">{t('landing.buyEyebrow')}</p>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-white/60">{t('landing.buyIntro')}</p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        {/* ── Left info panel ── */}
        <div className={`${shellCard} p-7 sm:p-8 order-2 xl:order-1`}>
          <SectionHeading body={t('trade.desc')} eyebrow={t('trade.instant')} title={`${t('trade.title1')} ${t('trade.title2')}`} />
          <div className="mt-8 space-y-4">
            {[
              { title: t('trade.feature1Title'), body: t('trade.feature1Desc') },
              { title: t('trade.feature2Title'), body: t('trade.feature2Desc') },
              { title: t('yield.mechanismTitle'), body: t('yield.mechanismDesc') }
            ].map((item) => (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5" key={item.title}>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-zinc-300">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <MetricCard hint="Native quote source" label={t('dashboard.navTitle')} value={onChainData?.nav || '$0.00'} />
            <MetricCard hint="Reference market price" label={t('dashboard.priceLabel')} value={formatCurrency(marketData?.priceUsd || 0, 4)} />
          </div>
          {/* Live price reference */}
          {gblinPriceFiat > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-400/70">
                Live reference price
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                1 GBLIN ≈ {fiat.symbol}{gblinPriceFiat.toFixed(4)} {fiat.code}
                <span className="ml-3 text-zinc-500">· {ethPriceFiat > 0 ? `1 ETH ≈ ${fiat.symbol}${ethPriceFiat.toFixed(0)}` : ''}</span>
              </p>
            </div>
          )}
        </div>

        {/* ── Right trade widget ── */}
        <div className={`${shellCard} p-7 sm:p-8 order-1 xl:order-2`}>

          {/* V5 → V6 migration banner — self-hides unless the wallet holds V5 */}
          <MigrateButton />

          {/* Buy / Sell / In-Kind toggle */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              className={`rounded-full px-6 py-3.5 sm:px-7 sm:py-4 text-sm sm:text-base font-bold uppercase tracking-[0.16em] transition ${mode === 'buy' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)]' : 'border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-emerald-500/30'}`}
              onClick={() => setMode('buy')}
              type="button"
            >
              {t('trade.buyBtn')}
            </button>
            <button
              className={`rounded-full px-6 py-3.5 sm:px-7 sm:py-4 text-sm sm:text-base font-bold uppercase tracking-[0.16em] transition ${mode === 'sell' ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)]' : 'border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-rose-500/30'}`}
              onClick={() => setMode('sell')}
              type="button"
            >
              {t('trade.sellBtn')}
            </button>
            <button
              className={`rounded-full px-6 py-3.5 sm:px-7 sm:py-4 text-sm sm:text-base font-bold uppercase tracking-[0.16em] transition ${mode === 'inkind' ? 'bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)]' : 'border border-amber-500/20 bg-amber-500/5 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/40'}`}
              onClick={() => setMode('inkind')}
              type="button"
              title={t('trade.inkindTitle')}
            >
              {t('trade.inkindBtn')}
            </button>
          </div>

          <a
            className="mt-3 block text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-amber-300"
            href="https://www.coinbase.com/how-to-buy/ethereum"
            rel="noreferrer"
            target="_blank"
          >
            {t('trade.needEth')}
          </a>

          {mode === 'inkind' ? (
            <div className="mt-6">
              <WhaleDepositPanel
                t={t}
                address={props.address}
                isConnected={isConnected}
                openWallet={openWallet}
              />
            </div>
          ) : null}

          {/* Balances */}
          {mode !== 'inkind' ? (
          <div className={`mt-6 grid gap-3 ${mode === 'buy' && selectedToken !== 'ETH' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">ETH {t('trade.balance')}</p>
              <p className="mt-2 text-lg font-semibold text-white">{ethBalance}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">GBLIN {t('trade.balance')}</p>
              <p className="mt-2 text-lg font-semibold text-white">{gblinBalance}</p>
            </div>
            {mode === 'buy' && selectedToken !== 'ETH' ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">{resolvedTokenSymbol} {t('trade.balance')}</p>
                <p className="mt-2 text-lg font-semibold text-white">{tokenBalance}</p>
              </div>
            ) : null}
          </div>
          ) : null}

          {mode !== 'inkind' ? (
          <div className="mt-6 space-y-5">

            {/* ── Input mode selector (only in buy mode with ETH) ── */}
            {mode === 'buy' && selectedToken === 'ETH' && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-2">
                  Input mode
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(['fiat', 'gblin'] as const).map((im) => {
                    const labels: Record<typeof im, string> = {
                      fiat: `${fiat.symbol} ${fiat.code}`,
                      gblin: 'GBLIN qty',
                    };
                    return (
                      <button
                        key={im}
                        type="button"
                        onClick={() => handleInputModeChange(im)}
                        className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] transition border ${
                          inputMode === im
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'border-white/[0.08] bg-white/[0.03] text-zinc-500 hover:text-white hover:border-white/20'
                        }`}
                      >
                        {labels[im]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom token address */}
            {mode === 'buy' && selectedToken === 'CUSTOM' ? (
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Token Address</span>
                <div className="mt-3 rounded-[24px] border border-white/10 bg-black/20 px-5 py-4">
                  <input className="w-full bg-transparent text-base font-medium text-white outline-none placeholder:text-zinc-600" onChange={(e) => setCustomTokenAddress(e.target.value)} placeholder="0x..." type="text" value={customTokenAddress} />
                </div>
              </label>
            ) : null}

            {/* Sell redeem option */}
            {mode === 'sell' ? (
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    aria-disabled={isEthRedeemBlocked}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${isEthRedeemBlocked ? 'cursor-not-allowed border-white/5 bg-black/30 text-zinc-600' : redeemOption === 'eth' ? 'border-amber-400/40 bg-amber-500/10 text-white' : 'border-white/10 bg-black/20 text-zinc-300 hover:bg-white/5'}`}
                    disabled={isEthRedeemBlocked}
                    onClick={() => setRedeemOption('eth')}
                    type="button"
                  >
                    <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">{t('trade.redeemOption')}</p>
                    <p className="mt-3 text-base font-semibold">ETH Only</p>
                    {isEthRedeemBlocked ? (
                      <p className="mt-1 text-[11px] font-medium text-amber-300/80">{t('trade.oracleGuard.badge')}</p>
                    ) : null}
                  </button>
                  <button className={`rounded-2xl border px-4 py-4 text-left transition ${redeemOption === 'basket' ? 'border-amber-400/40 bg-amber-500/10 text-white' : 'border-white/10 bg-black/20 text-zinc-300 hover:bg-white/5'}`} onClick={() => setRedeemOption('basket')} type="button">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">{t('trade.redeemOption')}</p>
                    <p className="mt-3 text-base font-semibold">Basket Tokens</p>
                  </button>
                </div>

                {isEthRedeemBlocked ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3" role="status">
                    <p className="text-sm font-semibold text-amber-200">{t('trade.oracleGuard.title')}</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-300">{t('trade.oracleGuard.body')}</p>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      {oracleHealth.feeds
                        .filter((feed) => feed.unusable)
                        .map((feed) => `${feed.asset}: ${feed.reason === 'stale' && feed.ageSeconds !== null ? `${Math.floor(feed.ageSeconds / 3600)}h ${Math.floor((feed.ageSeconds % 3600) / 60)}m old` : feed.reason}`)
                        .join(' · ')}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ── Main amount input ── */}
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                {mode === 'buy' && selectedToken === 'ETH' ? inputLabel[inputMode] : t('trade.amount')}
              </span>
              <div className="mt-3 rounded-[24px] border border-amber-500/20 bg-black/20 px-5 py-4 focus-within:border-amber-500/40 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <input
                    className="w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-zinc-600"
                    inputMode="decimal"
                    onChange={(e) => {
                      const val = e.target.value.replace(',', '.');
                      if (mode === 'buy' && selectedToken === 'ETH' && inputMode !== 'crypto') {
                        setDisplayValue(val);
                      } else {
                        handleCryptoAmountChange(val);
                      }
                    }}
                    placeholder={mode === 'buy' && selectedToken === 'ETH' ? inputPlaceholder[inputMode] : t('trade.enterAmount')}
                    type="text"
                    value={mode === 'buy' && selectedToken === 'ETH' && inputMode !== 'crypto' ? displayValue : amount}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (mode === 'sell') {
                        // VENDI: MAX = saldo GBLIN ESATTO, senza cuscinetto 0.9999. Vendere GBLIN
                        // non richiede di lasciare gas (il gas e' in ETH), quindi si vende tutto.
                        if (!gblinBalance || parseFloat(gblinBalance) <= 0) return;
                        handleCryptoAmountChange(gblinBalance);
                        return;
                      }
                      const bal = parseFloat(inputBalance);
                      if (!bal || bal <= 0) return;
                      const maxVal = (bal * 0.9999).toFixed(6);
                      if (mode === 'buy' && selectedToken === 'ETH' && inputMode !== 'crypto') {
                        if (inputMode === 'fiat') {
                          const ethBal = parseFloat(ethBalance);
                          const fiatMax = (ethBal * 0.9999 * ethPrice / fxRate).toFixed(2);
                          setDisplayValue(fiatMax);
                        } else {
                          const ethBal = parseFloat(ethBalance);
                          const gblinMax = gblinPriceUsd > 0 ? (ethBal * 0.9999 * ethPrice / gblinPriceUsd).toFixed(4) : '0';
                          setDisplayValue(gblinMax);
                        }
                      } else {
                        handleCryptoAmountChange(maxVal);
                      }
                    }}
                    className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 transition hover:bg-amber-500/20"
                  >
                    Max
                  </button>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-300">
                    {mode === 'buy' && selectedToken === 'ETH' ? inputSuffix[inputMode] : (mode === 'buy' ? resolvedTokenSymbol : 'GBLIN')}
                  </span>
                </div>
                {/* Countervalue / ETH amount */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
                  <span>{mode === 'sell' ? usdValue : (countervalue() || usdValue)}</span>
                  {mode === 'buy' && selectedToken === 'ETH' && inputMode !== 'crypto' && amount && (
                    <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                      {amount} ETH
                    </span>
                  )}
                  <span>{t('trade.balance')}: {inputBalance}</span>
                </div>
              </div>
            </label>

            {/* Slippage + Quote output */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">{t('trade.slippage')}</span>
                <input className="mt-3 w-full accent-amber-400" max={5} min={0.1} onChange={(e) => setSlippage(Number(e.target.value))} step={0.1} type="range" value={slippage} />
                <p className="mt-2 text-sm font-semibold text-white">{slippage.toFixed(1)}%</p>
              </label>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">{t('trade.outputAsset')}</p>
                <p className="mt-3 break-words text-base font-semibold leading-7 text-white">{isLoadingQuote ? '...' : (parseFloat(quote) > 0 && parseFloat(quote) < 0.0001 ? parseFloat(quote).toFixed(8) : quote)}</p>
                <p className="mt-2 text-sm text-zinc-500">{quoteAssetLabel}</p>
              </div>
            </div>

            {/* CTA */}
            <button
              className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-5 text-base font-bold uppercase tracking-[0.18em] transition ${isTradeDisabled ? 'cursor-not-allowed bg-zinc-800 text-zinc-500' : 'bg-amber-400 text-black hover:bg-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.3)]'}`}
              disabled={isTradeDisabled}
              onClick={isConnected ? executeTrade : openWallet}
              type="button"
            >
              {isTransacting ? t('trade.transacting') : isConnected ? mode === 'buy' ? t('trade.buyBtn') : t('trade.sellBtn') : t('trade.connectWallet')}
              <ArrowRight className="h-5 w-5" />
            </button>

            {/* The cost of the click, stated before the click. */}
            <p className="text-center text-xs leading-6 text-zinc-500">
              {mode === 'buy' ? t('landing.ctaMicro') : t('landing.sellMicro')}
            </p>

            {tradeError ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{tradeError}</div> : null}
            {tradeTxHash ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
                <p className="font-semibold">{t('trade.success')}</p>
                <a className="mt-2 inline-flex items-center gap-2 text-emerald-200 hover:text-white" href={`https://basescan.org/tx/${tradeTxHash}`} rel="noreferrer" target="_blank">
                  {t('trade.viewTx')}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ) : null}
          </div>
          ) : null}
        </div>
      </section>

      {/* Answers the question a buyer asks right after quoting: why is the DEX price different? */}
      <MintVsPoolSection t={t} />
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
                      className="h-full rounded-full transition-all duration-700"
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
                      className="h-full rounded-full bg-blue-400/60 transition-all duration-700"
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
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Stability Fund</p>
                <p className="mt-2 text-lg font-semibold text-white">{formatTokenAmount(Number(onChainData?.stabilityFund || 0), 8)} WETH</p>
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
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-3.5 text-sm font-bold uppercase tracking-[0.18em] text-black shadow-[0_0_24px_rgba(245,158,11,0.3)] transition-all hover:from-amber-400 hover:to-amber-300 hover:shadow-[0_0_36px_rgba(245,158,11,0.5)]"
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
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
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

  useEffect(() => {
    fetch('/api/rebalance-history')
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.events || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
          <p className="text-sm text-zinc-500">{t('rebalance.historyEmpty')}</p>
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
            <BasketCard asset={asset} key={asset.address} />
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
          {/* HERO — quanto è stato redistribuito a TUTTI i holder (il nostro punto di forza) */}
          <div className="mt-6 rounded-[24px] border border-amber-500/30 bg-amber-500/[0.06] p-6 sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/80">{t('dashboard.totalYieldTitle')}</p>
            <p className="mt-3 font-serif text-4xl sm:text-5xl xl:text-6xl font-semibold leading-none text-amber-300 break-words">{formatTokenAmount(onChainData?.totalYieldDistributed || 0, 6)} WETH</p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{t('yield.automationDesc')}</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <MetricCard hint="Immediate liquidity buffer" label={t('site.stabilityFund')} value={`${formatTokenAmount(Number(onChainData?.stabilityFund || 0), 8)} WETH`} />
            <MetricCard hint="Treasury net asset value" label={t('dashboard.navTitle')} value={onChainData?.nav || '$0.00'} />
          </div>
        </div>
      </section>
    </div>
  );
}
