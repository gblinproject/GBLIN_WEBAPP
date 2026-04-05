/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Activity, ArrowRight, Copy, Download, ExternalLink, Landmark, RefreshCw, Shield, TrendingUp, Wallet, Zap } from 'lucide-react';
import type { BasketItem, DashboardData, OnChainData, TransactionItem } from './protocol-data';
import { CONTRACT_ADDRESS, formatCurrency, formatTokenAmount, shortenAddress, WHITEPAPER_URL } from './protocol-data';

export type ProtocolView = 'home' | 'dashboard' | 'buy' | 'rebalance' | 'vault';

export interface RebalanceCard {
  name: string;
  actualWeight: number | null;
  dynamicWeight: number | null;
  baseWeight: number | null;
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
  mode: 'buy' | 'sell';
  inputBalance: string;
  setMode: (mode: 'buy' | 'sell') => void;
  amount: string;
  setAmount: (value: string) => void;
  quoteAssetLabel: string;
  redeemOption: 'eth' | 'basket';
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
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${tx.is_rebalance ? 'bg-amber-500/10 text-amber-300' : tx.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-300' : tx.type === 'SELL' ? 'bg-rose-500/10 text-rose-300' : 'bg-sky-500/10 text-sky-300'}`}>
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

export function HomeView(props: HomeViewProps) {
  const { t, onChainData, basketData, lastYieldDistribution, discountPercentage, isMarketLoading, isOnChainLoading, isConnected, address, openWallet, disconnectWallet, copyContract, copied } = props;

  return (
    <div className="space-y-12 sm:space-y-16">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)] xl:items-stretch">
        <div className={`${shellCard} relative overflow-hidden p-7 sm:p-10 lg:p-12`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_32%)]" />
          <div className="absolute -right-16 top-10 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-amber-200">
                <Shield className="h-3.5 w-3.5" />
                {t('dashboard.verified')}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-zinc-300">
                <Zap className="h-3.5 w-3.5 text-amber-300" />
                {t('hero.subtitle')}
              </div>
            </div>

            <div className="mt-8 max-w-3xl">
              <p className="text-[10px] font-mono uppercase tracking-[0.32em] text-zinc-500">{t('site.brandSubtitle')}</p>
              <h1 className="mt-4 font-serif text-[clamp(2.9rem,8vw,5.8rem)] leading-[0.92] tracking-tight text-white">
                {t('hero.title1')} <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text italic text-transparent">{t('hero.title2')}</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">{t('hero.desc')}</p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">{t('core.desc')}</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-black transition hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]" href="/buy-gblin">
                {t('nav.buyGblin')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white transition hover:bg-white/10 hover:text-amber-200" href="/dashboard">
                {t('nav.dashboard')}
              </Link>
              <button className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/20 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-200 transition hover:bg-white/10" onClick={copyContract} type="button">
                <Copy className="h-4 w-4" />
                {copied ? t('site.copied') : shortenAddress(CONTRACT_ADDRESS)}
              </button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:max-w-3xl">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  <Activity className="h-3.5 w-3.5 text-emerald-300" />
                  <span>{t('site.network')}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{t('site.live')}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  <Landmark className="h-3.5 w-3.5 text-amber-300" />
                  <span>{t('site.reserveTag')}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{t('site.stabilityTag')}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  <TrendingUp className="h-3.5 w-3.5 text-sky-300" />
                  <span>{t('site.yieldTag')}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{t('site.protocolSnapshotTitle')}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  <Shield className="h-3.5 w-3.5 text-amber-300" />
                  <span>{t('site.dynamicReserve')}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{formatTokenAmount(Number(onChainData?.dynamicReserve || 0), 4)} WETH</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:auto-rows-fr">
          <MetricCard hint={t('dashboard.backing')} label={t('dashboard.navTitle')} loading={isOnChainLoading} value={onChainData?.nav || '$0.00'} />
          <MetricCard hint={t('dashboard.assetsInVault')} label={t('dashboard.tvlTitle')} loading={isOnChainLoading} value={formatCurrency(onChainData?.tvl || 0)} />
          <MetricCard hint={t('dashboard.inCirculation')} label={t('dashboard.supplyTitle')} loading={isOnChainLoading} value={onChainData?.totalSupply || '0'} />
          <MetricCard hint={t('dashboard.protocolDesc')} label={t('dashboard.apyTitle')} loading={isMarketLoading} value={`${onChainData?.apyData?.estimatedApy || '0.00'}%`} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <HighlightCard body={t('core.bankDesc')} icon={<Landmark className="h-5 w-5" />} title={t('core.bankTitle')} />
        <HighlightCard body={t('core.crashShieldDesc')} icon={<Shield className="h-5 w-5" />} title={t('core.crashShieldTitle')} />
        <HighlightCard body={t('core.appreciationDesc')} icon={<TrendingUp className="h-5 w-5" />} title={t('core.appreciationTitle')} />
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
        <div className={`${shellCard} min-w-0 p-7 sm:p-8`}>
          <SectionHeading body={t('vault.desc')} eyebrow={t('vault.core')} title={t('vault.title')} />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {basketData.map((asset) => (
              <BasketCard asset={asset} key={asset.address} />
            ))}
          </div>
        </div>
        <div className={`${shellCard} min-w-0 p-7 sm:p-8`}>
          <SectionHeading body={t('yield.desc')} eyebrow={t('yield.title')} title={t('core.architectureTitle')} />
          <div className="mt-8 space-y-4">
            {[
              { title: t('yield.step1Title'), body: t('yield.step1Desc') },
              { title: t('yield.step2Title'), body: t('yield.step2Desc') },
              { title: t('yield.step3Title'), body: t('yield.step3Desc') }
            ].map((item) => (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5" key={item.title}>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-zinc-300">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${shellCard} overflow-hidden p-7 sm:p-10`}>
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.38em] text-zinc-500">{t('site.protocolSnapshotEyebrow')}</p>
            <h2 className={`mt-3 ${sectionTitle}`}>{t('site.protocolSnapshotTitle')}</h2>
            <p className={`mt-4 ${sectionBody}`}>{t('dashboard.protocolDesc')}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100" href="/rebalance">
                {t('nav.rebalance')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10" onClick={copyContract} type="button">
                <Copy className="h-4 w-4" />
                {copied ? t('site.copied') : shortenAddress(CONTRACT_ADDRESS)}
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard hint={t('site.marketVsNav')} label={t('site.discountPremium')} value={`${discountPercentage.toFixed(2)}%`} />
            <MetricCard hint={t('site.recentContractCycle')} label={t('site.lastYield')} value={formatDateLabel(lastYieldDistribution)} />
            <MetricCard hint="Liquidity backstop" label={t('site.stabilityFund')} value={`${formatTokenAmount(Number(onChainData?.stabilityFund || 0), 4)} WETH`} />
            <MetricCard hint={t('site.connectedOperator')} label="Wallet" value={isConnected && address ? shortenAddress(address) : t('site.notConnected')} />
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <WalletPanel address={address} disconnectWallet={disconnectWallet} isConnected={isConnected} openWallet={openWallet} t={t} />
          <div className={`${shellCard} p-5`}>
            <p className="text-[11px] uppercase tracking-[0.32em] text-zinc-500">{t('site.research')}</p>
            <p className="mt-3 text-lg font-semibold text-white">{t('site.researchTitle')}</p>
            <p className="mt-3 text-sm leading-7 text-zinc-300">{t('yield.mechanismDesc')}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-100" href={WHITEPAPER_URL} rel="noreferrer" target="_blank">
                <Download className="h-4 w-4" />
                {t('site.whitepaper')}
              </a>
              <a className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10" href={`https://basescan.org/address/${CONTRACT_ADDRESS}`} rel="noreferrer" target="_blank">
                <ExternalLink className="h-4 w-4" />
                {t('site.basescan')}
              </a>
            </div>
          </div>
        </div>
      </section>
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
                {copied ? t('site.copied') : shortenAddress(CONTRACT_ADDRESS)}
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
                logs.map((log) => (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300" key={log}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className={`${shellCard} p-5`}>
            <p className="text-sm font-semibold text-white">{t('site.reserveEngine')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('site.stabilityFund')}</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatTokenAmount(Number(onChainData?.stabilityFund || 0), 4)} WETH</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('site.dynamicReserve')}</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatTokenAmount(Number(onChainData?.dynamicReserve || 0), 4)} WETH</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('dashboard.apyTitle')}</p>
                <p className="mt-2 text-xl font-semibold text-white">{onChainData?.apyData?.estimatedApy || '0.00'}%</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function BuyView(props: BuyViewProps) {
  const { t, mode, setMode, amount, setAmount, slippage, setSlippage, quote, usdValue, isLoadingQuote, isTransacting, isTradeDisabled, executeTrade, tradeError, tradeTxHash, ethBalance, gblinBalance, inputBalance, isConnected, openWallet, marketData, onChainData, buyTokenOptions, customTokenAddress, quoteAssetLabel, redeemOption, resolvedTokenSymbol, selectedToken, setCustomTokenAddress, setRedeemOption, setSelectedToken, tokenBalance } = props;

  return (
    <div className="space-y-12">
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className={`${shellCard} p-7 sm:p-8`}>
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
        </div>

        <div className={`${shellCard} p-7 sm:p-8`}>
          <div className="flex flex-wrap gap-3">
            <button className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${mode === 'buy' ? 'bg-amber-400 text-black' : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'}`} onClick={() => setMode('buy')} type="button">
              {t('trade.buyBtn')}
            </button>
            <button className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${mode === 'sell' ? 'bg-amber-400 text-black' : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'}`} onClick={() => setMode('sell')} type="button">
              {t('trade.sellBtn')}
            </button>
          </div>

          <div className={`mt-8 grid gap-4 ${mode === 'buy' && selectedToken !== 'ETH' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">ETH {t('trade.balance')}</p>
              <p className="mt-2 text-xl font-semibold text-white">{ethBalance}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">GBLIN {t('trade.balance')}</p>
              <p className="mt-2 text-xl font-semibold text-white">{gblinBalance}</p>
            </div>
            {mode === 'buy' && selectedToken !== 'ETH' ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{resolvedTokenSymbol} {t('trade.balance')}</p>
                <p className="mt-2 text-xl font-semibold text-white">{tokenBalance}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-5">
            {mode === 'buy' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block rounded-2xl border border-white/10 bg-black/20 p-4">
                  <span className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('trade.inputAsset')}</span>
                  <select className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-amber-400/50" onChange={(event) => setSelectedToken(event.target.value)} value={selectedToken}>
                    {buyTokenOptions.map((tokenOption) => (
                      <option className="bg-[#0A0A0A]" key={tokenOption} value={tokenOption}>{tokenOption}</option>
                    ))}
                  </select>
                </label>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <span className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('trade.balance')}</span>
                  <p className="mt-3 text-xl font-semibold text-white">{inputBalance}</p>
                  <p className="mt-2 text-sm text-zinc-500">{resolvedTokenSymbol}</p>
                </div>
              </div>
            ) : null}

            {mode === 'buy' && selectedToken === 'CUSTOM' ? (
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Token Address</span>
                <div className="mt-3 rounded-[24px] border border-white/10 bg-black/20 px-5 py-4">
                  <input className="w-full bg-transparent text-base font-medium text-white outline-none placeholder:text-zinc-600" onChange={(event) => setCustomTokenAddress(event.target.value)} placeholder="0x..." type="text" value={customTokenAddress} />
                </div>
              </label>
            ) : null}

            {mode === 'sell' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <button className={`rounded-2xl border px-4 py-4 text-left transition ${redeemOption === 'eth' ? 'border-amber-400/40 bg-amber-500/10 text-white' : 'border-white/10 bg-black/20 text-zinc-300 hover:bg-white/5'}`} onClick={() => setRedeemOption('eth')} type="button">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('trade.redeemOption')}</p>
                  <p className="mt-3 text-base font-semibold">ETH Only</p>
                </button>
                <button className={`rounded-2xl border px-4 py-4 text-left transition ${redeemOption === 'basket' ? 'border-amber-400/40 bg-amber-500/10 text-white' : 'border-white/10 bg-black/20 text-zinc-300 hover:bg-white/5'}`} onClick={() => setRedeemOption('basket')} type="button">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('trade.redeemOption')}</p>
                  <p className="mt-3 text-base font-semibold">Basket Tokens</p>
                </button>
              </div>
            ) : null}

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('trade.amount')}</span>
              <div className="mt-3 rounded-[24px] border border-white/10 bg-black/20 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <input className="w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-zinc-600" inputMode="decimal" onChange={(event) => setAmount(event.target.value.replaceAll(',', '.'))} placeholder={t('trade.enterAmount')} type="text" value={amount} />
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-300">{mode === 'buy' ? resolvedTokenSymbol : 'GBLIN'}</span>
                </div>
                <p className="mt-3 text-sm text-zinc-500">{usdValue} · {t('trade.balance')}: {inputBalance}</p>
              </div>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('trade.slippage')}</span>
                <input className="mt-3 w-full accent-amber-400" max={5} min={0.1} onChange={(event) => setSlippage(Number(event.target.value))} step={0.1} type="range" value={slippage} />
                <p className="mt-2 text-sm font-semibold text-white">{slippage.toFixed(1)}%</p>
              </label>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t('trade.outputAsset')}</p>
                <p className="mt-3 break-words text-base font-semibold leading-7 text-white">{isLoadingQuote ? '...' : quote}</p>
                <p className="mt-2 text-sm text-zinc-500">{quoteAssetLabel}</p>
              </div>
            </div>

            <button className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${isTradeDisabled ? 'cursor-not-allowed bg-zinc-800 text-zinc-500' : 'bg-amber-400 text-black hover:bg-amber-300'}`} disabled={isTradeDisabled} onClick={isConnected ? executeTrade : openWallet} type="button">
              {isTransacting ? t('trade.transacting') : isConnected ? mode === 'buy' ? t('trade.buyBtn') : t('trade.sellBtn') : t('trade.connectWallet')}
              <ArrowRight className="h-4 w-4" />
            </button>

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
        </div>
      </section>
    </div>
  );
}

export function RebalanceView(props: RebalanceViewProps) {
  const { t, rebalanceOverviewCards, autoRebalanceOpportunity, rebalanceBountyActive, rebalanceMinSwapRequiredEth, isArbitraging, isArbDisabled, executeArbitrage, arbError, arbTxHash, isConnected, openWallet, onChainData } = props;

  return (
    <div className="space-y-12">
      <section className={`${shellCard} p-7 sm:p-10`}>
        <SectionHeading body={t('rebalance.desc')} eyebrow={t('rebalance.badge')} title={t('rebalance.title')} />
      </section>

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
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-zinc-300">
                  {card.directionLabel}
                </div>
              </div>
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
                <p className="mt-2 text-lg font-semibold text-white">{formatTokenAmount(Number(onChainData?.stabilityFund || 0), 4)} WETH</p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm leading-7 text-zinc-300">{t('rebalance.gasNotice')}</p>
            <p className="text-sm leading-7 text-zinc-300">{t('rebalance.floorNotice')}</p>
            <p className="text-sm leading-7 text-zinc-300">{t('rebalance.recommendationCounterparty')}</p>
          </div>

          <button className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${isArbDisabled ? 'cursor-not-allowed bg-zinc-800 text-zinc-500' : 'bg-amber-400 text-black hover:bg-amber-300'}`} disabled={isArbDisabled} onClick={isConnected ? executeArbitrage : openWallet} type="button">
            {isArbitraging ? t('rebalance.processing') : isConnected ? t('rebalance.execute') : t('rebalance.connectWallet')}
            <Zap className="h-4 w-4" />
          </button>

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
        </div>
      </section>
    </div>
  );
}

export function VaultView(props: VaultViewProps) {
  const { t, basketData, onChainData, lastYieldDistribution } = props;

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
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <MetricCard hint="Last automated cycle" label={t('site.lastYield')} value={formatDateLabel(lastYieldDistribution)} />
            <MetricCard hint="Protocol reserve target" label={t('site.dynamicReserve')} value={`${formatTokenAmount(Number(onChainData?.dynamicReserve || 0), 4)} WETH`} />
            <MetricCard hint="Immediate liquidity buffer" label={t('site.stabilityFund')} value={`${formatTokenAmount(Number(onChainData?.stabilityFund || 0), 4)} WETH`} />
            <MetricCard hint="Treasury net asset value" label={t('dashboard.navTitle')} value={onChainData?.nav || '$0.00'} />
          </div>
          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm leading-7 text-zinc-300">{t('yield.automationDesc')}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
