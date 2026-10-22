'use client';

import { useState, useMemo, useEffect } from 'react';
import { PublicShell } from '@/components/protocol/public-shell';
import { useT } from '@/components/protocol/i18n-context';

type Trade = {
  asset: string;
  pnl_usd: number;
  direction?: string;
  commit_hash?: string;
  verified?: boolean;
  closed_at?: number;
  opened_at?: number;
  entry_price?: number;
  exit_price?: number;
  size_usd?: number;
  catalyst?: string;
  conviction?: number;
  liquidated?: boolean;
};
type EquityPoint = { t: number; equity: number };
type Metrics = {
  profit_factor: number | null;
  sharpe_per_trade: number | null;
  max_drawdown_pct: number | null;
  avg_win_usd: number | null;
  avg_loss_usd: number | null;
  liquidations: number;
  equity_curve: EquityPoint[];
};
type OpenPosition = {
  asset: string;
  direction: string;
  kind: string;
  delta_neutral: boolean;
  entry_price: number;
  current_price: number | null;
  size_usd: number;
  leverage: number;
  unrealized_pnl: number | null;
  catalyst: string;
  conviction: number;
  commit_hash: string;
  opened_at: number;
};
type Stats = {
  updated: number;
  dry_run: boolean;
  halted: boolean;
  halt_reason: string | null;
  capital_usd: number;
  equity_usd?: number;
  equity_mtm_usd?: number;
  equity_peak_usd?: number;
  drawdown_from_peak_pct?: number;
  realized_pnl_usd: number;
  lifetime_pnl_usd: number;
  net_pnl_usd?: number;
  open_count: number;
  total_unrealized_pnl: number;
  open_positions: OpenPosition[];
  closed_count: number;
  win_rate: number;
  top_trades: Trade[];
  all_trades: Trade[];
  metrics?: Metrics;
  esperimenti?: Experiments;
  exposure?: { gross_usd: number; gross_x: number | null; cap_x: number };
  halt_pct?: number;
  benchmark?: Benchmark | null;
  gate?: Gate | null;
};
type Benchmark = {
  since: number;
  days: number;
  return_pct: number;
  btc_return_pct: number | null;
  avg_gross_x: number;
  gross_x_now: number;
  benchmark_pct: number | null;
  excess_pct: number | null;
  positive_days: number;
  negative_days: number;
  worst_day_pct: number | null;
  best_day_pct: number | null;
};
type GateCheck = [number | null, number, boolean];
type Gate = {
  checks: { days: GateCheck; closed_trades: GateCheck; sharpe: GateCheck; beats_benchmark: GateCheck };
  passed: boolean;
};
type IntradayReport = {
  updated: number;
  since: number;
  dry_run: boolean;
  start_capital_usd: number;
  equity_mtm_usd: number;
  net_pnl_usd: number;
  realized_pnl_usd: number;
  open_count: number;
  closed_count: number;
  estimated_costs_usd: number;
  funding_pnl_usd: number;
  max_drawdown_pct: number;
  maximum_loss_usd: number;
  data_complete: boolean;
  stale?: boolean;
  last_error?: string | null;
  halt_reason?: string | null;
  session_halted?: boolean;
  pnl_before_cost_and_funding_usd?: number;
  profit_factor?: number | null;
  open_positions: {
    asset: string; direction: string; opened_at: number; entry_price?: number; quantity?: number;
    size_usd?: number; notional_usd?: number; leverage?: number; last_mark_price?: number | null;
    unrealized_pnl_usd?: number | null; protective_stop_price?: number; session_target_price?: number;
  }[];
  closed_trades?: {
    asset: string; direction: string; opened_at: number; closed_at: number; entry_price: number;
    exit_price: number; size_usd: number; leverage?: number; pnl_usd: number; cost_usd?: number;
    funding_pnl_usd?: number; exit_reason?: string; hold_hours?: number;
  }[];
  daily_results?: Record<string, { net_pnl_usd: number; equity_usd: number }>;
};
type IntradayExperiment = IntradayReport | { error: string };
type Experiments = {
  daytrade_v18?: IntradayExperiment;
  twin_flip?: {
    aperti: { asset: string; direction: string; entry_price: number; opened_at: number }[];
    chiusi: number;
    netto_usd: number;
  };
  twin_trail?: { chiusi: number; netto_usd: number };
  intraday_shadow?: { chiusi: number; netto_usd: number };
  twin_lb?: { aperti: number; chiusi: number; netto_usd: number };
  short_sleeve?: {
    aperti: { asset: string; entry_price: number; opened_at: number }[];
    chiusi: number;
    netto_usd: number;
  };
  cascade_sig?: { aperti: number; chiusi: number; netto_usd: number };
  cascade_liq?: { aperti: number; chiusi: number; netto_usd: number };
  quality_ls?: { aperti: number; chiusi: number; netto_usd: number };
  funding_disp?: {
    osservazioni: number;
    aperte: { asset: string; long: string; short: string; accrued_usd: number; opened_at: number }[];
    chiuse_v2: number;
    netto_v2_usd: number;
    nozionale_gamba: number;
  };
  memoria_asset?: Record<string, number>;
  memoria_min_campioni?: number;
};

// The previous account (V16) is kept in the source but hidden from the public page for now.
const SHOW_PREVIOUS_ACCOUNT = false;

async function getStats(): Promise<Stats | null> {
  try {
    const r = await fetch('/api/aureus', { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.stats || null;
  } catch {
    return null;
  }
}

function fmtUsd(n: number | null | undefined, decimals = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(decimals);
}

function fmtPct(n: number | null | undefined, decimals = 2) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(decimals)}%`;
}

function pnlColor(n: number | null | undefined) {
  if (n === null || n === undefined) return 'text-gray-400';
  return n >= 0 ? 'text-emerald-400' : 'text-red-400';
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function KpiCard({
  label, value, good, warn,
}: {
  label: string;
  value: number | string | null | undefined;
  good: (v: number | string) => boolean;
  warn: (v: number | string) => boolean;
}) {
  const color =
    value == null
      ? 'text-gray-400'
      : good(value)
      ? 'text-emerald-400'
      : warn(value)
      ? 'text-amber-400'
      : 'text-red-400';
  const display =
    value == null
      ? '—'
      : typeof value === 'number'
      ? value.toFixed(2)
      : value;
  return (
    <div className="rounded-xl bg-white/5 border border-gray-800 p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{display}</div>
    </div>
  );
}

function EquityCurve({
  curve, peak, emptyLabel,
}: {
  curve: EquityPoint[];
  peak: number | undefined;
  emptyLabel: string;
}) {
  if (!curve || curve.length < 2) {
    return (
      <div className="h-28 flex items-center justify-center text-xs text-gray-600">
        {emptyLabel}
      </div>
    );
  }
  const W = 600;
  const H = 80;
  const pad = 2;
  const minY = Math.min(...curve.map((p) => p.equity));
  const maxY = Math.max(...curve.map((p) => p.equity));
  const rangeY = maxY - minY || 1;
  const minT = curve[0].t;
  const maxT = curve[curve.length - 1].t;
  const rangeT = maxT - minT || 1;
  const toX = (t: number) => pad + ((t - minT) / rangeT) * (W - pad * 2);
  const toY = (e: number) => H - pad - ((e - minY) / rangeY) * (H - pad * 2);
  const pts = curve.map((p) => `${toX(p.t).toFixed(1)},${toY(p.equity).toFixed(1)}`).join(' ');
  const peakY = peak != null ? toY(Math.min(peak, maxY)).toFixed(1) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
      {peakY && (
        <line
          x1={pad} y1={peakY} x2={W - pad} y2={peakY}
          stroke="#6b7280" strokeWidth="1" strokeDasharray="4 3"
        />
      )}
      <polyline
        points={pts}
        fill="none"
        stroke="#34d399"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AureusPage() {
  return (
    <PublicShell>
      <AureusContent />
    </PublicShell>
  );
}

function AureusContent() {
  const { t } = useT();
  const [s, setStats] = useState<Stats | null>(null);
  // Default '7d': with 'today' the section renders empty whenever no position has been
  // closed during the current day, which reads as a broken page rather than as no data.
  const [filter, setFilter] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await getStats();
        if (!active) return;
        if (data) setStats(data);
        setFetchFailed(data === null);
        setLoading(false);
        setNow(Date.now() / 1000);
      } finally {
        inFlight = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 60000);
    const clock = setInterval(() => setNow(Date.now() / 1000), 30000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearInterval(interval);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const allocated = s?.open_positions?.reduce((sum, p) => sum + (p.size_usd || 0), 0) ?? 0;

  const tradeSource = s?.all_trades?.length ? s.all_trades : (s?.top_trades ?? []);

  const filteredTrades = useMemo(() => {
    if (!tradeSource.length) return [];
    const now = Date.now() / 1000;
    const days = filter === 'today' ? 1 : filter === '7d' ? 7 : filter === '30d' ? 30 : 36500;
    const filtered = tradeSource.filter((t) => !t.closed_at || (now - t.closed_at) < days * 86400);
    return filtered.sort((a, b) => (b.closed_at || 0) - (a.closed_at || 0));
  }, [tradeSource, filter]);

  const hallOfFame = useMemo(() => {
    if (!tradeSource.length) return [];
    const byAsset = new Map<string, Trade[]>();
    tradeSource.forEach((t) => {
      if (!byAsset.has(t.asset)) byAsset.set(t.asset, []);
      byAsset.get(t.asset)!.push(t);
    });
    return Array.from(byAsset.entries())
      .map(([asset, trades]) => {
        const best = trades.reduce((max, t) => (t.pnl_usd > max.pnl_usd ? t : max), trades[0]);
        return { asset, best, totalTrades: trades.length, totalPnl: trades.reduce((s, t) => s + t.pnl_usd, 0) };
      })
      .sort((a, b) => b.best.pnl_usd - a.best.pnl_usd)
      .slice(0, 5);
  }, [s?.all_trades]);

  return (
      <main className="max-w-7xl mx-auto px-6 py-8 font-sans text-gray-200">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-3xl font-bold">{t('aureus.title')}</h1>
        {s && (
          <span className={`text-xs px-2 py-1 rounded ${s.dry_run
            ? 'bg-amber-900/40 text-amber-400 border border-amber-800'
            : 'bg-emerald-900/40 text-emerald-400 border border-emerald-800'}`}>
            {s.dry_run ? t('aureus.dryRun') : t('aureus.live')}
          </span>
        )}
      </div>
      <p className="text-gray-400 mb-10 leading-relaxed">{t('aureus.description')}</p>

      {loading && (
        <div className="border border-gray-800 rounded-lg p-8 text-gray-400 text-center">
          {t('aureus.loading')}
        </div>
      )}
      {!s && !loading && (
        <div className="border border-gray-800 rounded-lg p-8 text-gray-400 text-center">
          {t('aureus.noData')}
        </div>
      )}
      {s && (
        <>
          <IntradaySummary report={s.esperimenti?.daytrade_v18} now={now} fetchFailed={fetchFailed} />
          {SHOW_PREVIOUS_ACCOUNT && (
          <details className="mb-10 rounded-xl border border-gray-800 p-5">
            <summary className="cursor-pointer text-lg font-semibold text-gray-300">
              {t('aureus.previousAccount')}
            </summary>
            <p className="mt-2 mb-6 text-sm text-gray-500">{t('aureus.previousAccountNote')}</p>
          {s.halted && (
            <div className="mb-6 flex items-center gap-3 bg-red-950/60 border border-red-700 rounded-xl px-5 py-4">
              <span className="text-red-400 text-xl">&#9888;</span>
              <div>
                <p className="text-sm font-bold text-red-400 uppercase tracking-wide">{t('aureus.haltedTitle')}</p>
                {s.halt_reason && <p className="text-xs text-red-300 mt-0.5">{s.halt_reason}</p>}
              </div>
            </div>
          )}

          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Stat label={t('aureus.capital')} value={`$${s.capital_usd.toFixed(2)}`} />
            <Stat label={t('aureus.allocated')} value={`$${allocated.toFixed(2)} / $${s.capital_usd.toFixed(2)}`}
              tone={allocated >= s.capital_usd ? 'neg' : undefined} />
            {/* LIFETIME P&L net of creator fees, not the daily `realized_pnl_usd`
                counter, which resets every day and feeds only the daily loss limit.
                The daily counter is deliberately NOT part of the fallback chain:
                it is a different metric and would contradict this label. */}
            <Stat label={t('aureus.netPnl')}
              value={fmtUsd(s.net_pnl_usd ?? s.lifetime_pnl_usd)}
              tone={(s.net_pnl_usd ?? s.lifetime_pnl_usd) >= 0 ? 'pos' : 'neg'}
              hint={t('aureus.netPnlHint')} />
            <Stat label={t('aureus.winRate')} value={`${(s.win_rate * 100).toFixed(0)}%`} />
            <Stat label={t('aureus.openPositionsLabel')} value={`${s.open_count}`} />
            <Stat label={t('aureus.closedTrades')} value={`${s.closed_count}`} />
          </section>

          {s.metrics && (
            <section className="mb-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                  label={t('aureus.profitFactor')}
                  value={s.metrics.profit_factor}
                  good={(v) => (v as number) > 1.3}
                  warn={(v) => (v as number) >= 1.0}
                />
                <KpiCard
                  label={t('aureus.sharpe')}
                  value={s.metrics.sharpe_per_trade}
                  good={(v) => (v as number) > 0.5}
                  warn={(v) => (v as number) >= 0}
                />
                <KpiCard
                  label={t('aureus.maxDrawdown')}
                  value={s.metrics.max_drawdown_pct != null ? `${(s.metrics.max_drawdown_pct * 100).toFixed(1)}%` : null}
                  good={() => (s.metrics!.max_drawdown_pct ?? 1) < 0.05}
                  warn={() => (s.metrics!.max_drawdown_pct ?? 1) < 0.10}
                />
                <KpiCard
                  label={`${t('aureus.liquidations')} ⚠`}
                  value={s.metrics.liquidations}
                  good={(v) => v === 0}
                  warn={() => false}
                />
              </div>

              {(s.drawdown_from_peak_pct != null) && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{t('aureus.drawdownFromPeak')} {((s.halt_pct ?? 0.10) * 100).toFixed(0)}%</span>
                    <span className={(
                      (s.drawdown_from_peak_pct ?? 0) >= (s.halt_pct ?? 0.10) ? 'text-red-400' :
                      (s.drawdown_from_peak_pct ?? 0) >= (s.halt_pct ?? 0.10) / 2 ? 'text-amber-400' :
                      'text-emerald-400'
                    )}>
                      {((s.drawdown_from_peak_pct ?? 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (s.drawdown_from_peak_pct ?? 0) >= (s.halt_pct ?? 0.10) ? 'bg-red-500' :
                        (s.drawdown_from_peak_pct ?? 0) >= (s.halt_pct ?? 0.10) / 2 ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min((s.drawdown_from_peak_pct ?? 0) / (s.halt_pct ?? 0.10) * 100, 100).toFixed(1)}%` }}
                    />
                  </div>
                </div>
              )}

              {s.metrics.equity_curve && s.metrics.equity_curve.length >= 2 && (
                <div className="mt-5 bg-white/5 border border-gray-800 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs uppercase tracking-wider text-gray-500">{t('aureus.equityCurve')}</p>
                    {s.equity_peak_usd != null && (
                      <p className="text-xs text-gray-600">
                        {t('aureus.peakLabel')} <span className="text-gray-400">${s.equity_peak_usd.toFixed(2)}</span>
                        {' — '}
                        <span className="text-gray-400">
                          {s.equity_mtm_usd != null ? `MTM $${s.equity_mtm_usd.toFixed(2)}` : ''}
                        </span>
                      </p>
                    )}
                  </div>
                  <EquityCurve curve={s.metrics.equity_curve} peak={s.equity_peak_usd} emptyLabel={t('aureus.loading')} />
                  <p className="text-[10px] text-gray-700 mt-2">
                    {t('aureus.dashedLineNote')} {s.metrics.equity_curve.length} {t('aureus.points')}.
                  </p>
                </div>
              )}

              {s.benchmark && (
                <div className="mt-5 bg-white/5 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{t('aureus.benchmarkHeading')}</p>
                  <p className="text-[11px] text-gray-600 mb-3">{t('aureus.benchmarkNote')}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label={t('aureus.bmReturn')} value={fmtPct(s.benchmark.return_pct)}
                      tone={s.benchmark.return_pct >= 0 ? 'pos' : 'neg'} hint={`${s.benchmark.days.toFixed(1)} d`} />
                    <Stat label={t('aureus.bmBtc')} value={fmtPct(s.benchmark.benchmark_pct)}
                      hint={`BTC ${fmtPct(s.benchmark.btc_return_pct)} × ${s.benchmark.avg_gross_x.toFixed(2)}x`} />
                    <Stat label={t('aureus.bmExcess')} value={fmtPct(s.benchmark.excess_pct)}
                      tone={(s.benchmark.excess_pct ?? 0) >= 0 ? 'pos' : 'neg'} />
                    <Stat label={t('aureus.bmExposure')}
                      value={`${(s.exposure?.gross_x ?? s.benchmark.gross_x_now).toFixed(2)}x / ${(s.exposure?.cap_x ?? 1).toFixed(1)}x`} />
                    <Stat label={t('aureus.bmDays')} value={`${s.benchmark.positive_days} / ${s.benchmark.negative_days}`} />
                    <Stat label={t('aureus.bmWorstDay')} value={fmtPct(s.benchmark.worst_day_pct)} tone="neg" />
                    <Stat label={t('aureus.bmBestDay')} value={fmtPct(s.benchmark.best_day_pct)} tone="pos" />
                  </div>
                </div>
              )}

              {s.gate && (
                <div className="mt-5 bg-white/5 border border-gray-800 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs uppercase tracking-wider text-gray-500">{t('aureus.gateHeading')}</p>
                    <p className={`text-xs ${s.gate.passed ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {s.gate.passed ? t('aureus.gatePassed') : t('aureus.gatePending')}
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-600 mb-3">{t('aureus.gateNote')}</p>
                  <ul className="space-y-1 text-sm">
                    {([
                      ['gateDays', s.gate.checks.days, (v: number) => v.toFixed(1), (v: number) => `≥ ${v}`],
                      ['gateClosed', s.gate.checks.closed_trades, (v: number) => String(v), (v: number) => `≥ ${v}`],
                      ['gateSharpe', s.gate.checks.sharpe, (v: number) => v.toFixed(2), (v: number) => `≥ ${v}`],
                      ['gateBeats', s.gate.checks.beats_benchmark, (v: number) => fmtPct(v), () => '> 0'],
                    ] as [string, GateCheck, (v: number) => string, (v: number) => string][]).map(([k, c, fv, ft]) => (
                      <li key={k} className="flex justify-between">
                        <span className="text-gray-400">{c[2] ? '✓' : '○'} {t(`aureus.${k}`)}</span>
                        <span className={c[2] ? 'text-emerald-400' : 'text-gray-500'}>
                          {c[0] == null ? '—' : fv(c[0])} <span className="text-gray-700">({ft(c[1])})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {s.open_positions && s.open_positions.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{t('aureus.openPositionsHeading')} ({s.open_count})</h2>
                <span className={`text-sm font-bold ${pnlColor(s.total_unrealized_pnl)}`}>
                  {t('aureus.unrealizedPnl')} {fmtUsd(s.total_unrealized_pnl, 4)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-800">
                      <th className="pb-2 pr-4">{t('aureus.colAsset')}</th>
                      <th className="pb-2 pr-4">{t('aureus.colType')}</th>
                      <th className="pb-2 pr-4">{t('aureus.colDir')}</th>
                      <th className="pb-2 pr-4">{t('aureus.colSizeLev')}</th>
                      <th className="pb-2 pr-4">{t('aureus.colEntry')}</th>
                      <th className="pb-2 pr-4">{t('aureus.colPrice')}</th>
                      <th className="pb-2 pr-4">{t('aureus.colPnl')}</th>
                      <th className="pb-2">{t('aureus.colConv')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.open_positions.map((p, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 pr-4 font-medium">{p.asset}</td>
                        <td className="py-3 pr-4">
                          {p.delta_neutral ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-800">
                              {t('aureus.carryCovered')}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">{p.kind || 'directional'}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                            p.direction === 'long' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                          }`}>{p.direction}</span>
                        </td>
                        <td className="py-3 pr-4 text-gray-300">
                          ${p.size_usd.toFixed(0)} · {p.leverage}x
                        </td>
                        <td className="py-3 pr-4 text-gray-300 font-mono text-xs">
                          {p.entry_price.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-gray-300 font-mono text-xs">
                          {p.delta_neutral ? '—' : (p.current_price?.toLocaleString() ?? '—')}
                        </td>
                        <td className={`py-3 pr-4 font-bold ${pnlColor(p.unrealized_pnl)}`}>
                          {fmtUsd(p.unrealized_pnl, 4)}
                          {p.delta_neutral && p.unrealized_pnl !== null && (
                            <span className="ml-1 text-[10px] text-blue-400 font-normal">{t('aureus.funding')}</span>
                          )}
                        </td>
                        <td className="py-3 text-gray-400 text-xs">
                          {(p.conviction * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-600 mt-3">{t('aureus.carryNote')}</p>
            </section>
          )}

          {hallOfFame.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-4">{t('aureus.hallOfFame')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {hallOfFame.map(({ asset, best, totalTrades, totalPnl }) => (
                  <div
                    key={asset}
                    onClick={() => setSelectedTrade(best)}
                    className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-gray-500 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-lg">{asset}</span>
                      <span className={`text-sm font-bold ${best.pnl_usd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmtUsd(best.pnl_usd)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>{totalTrades} {t('aureus.totalTrades')} · P&L: {fmtUsd(totalPnl)}</p>
                      <p className="text-gray-500">{t('aureus.best')} {best.direction} @ ${best.entry_price?.toFixed(2)}</p>
                    </div>
                    {best.verified && (
                      <span className="inline-block mt-2 text-[10px] text-emerald-500">✓ {t('aureus.verified')}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {s.esperimenti && Object.keys(s.esperimenti).length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-1">{t('aureus.experimentsHeading')}</h2>
              <p className="text-xs text-gray-500 mb-4">{t('aureus.experimentsNote')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {s.esperimenti.twin_flip && (
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-4">
                    <div className="font-bold mb-2">{t('aureus.expTwinFlip')}</div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>{s.esperimenti.twin_flip.aperti.length} {t('aureus.expOpen')} · {s.esperimenti.twin_flip.chiusi} {t('aureus.expClosed')}</p>
                      <p className={pnlColor(s.esperimenti.twin_flip.netto_usd)}>
                        {t('aureus.expNet')}: {fmtUsd(s.esperimenti.twin_flip.netto_usd)}
                      </p>
                      {s.esperimenti.twin_flip.aperti.map((p) => (
                        <p key={p.asset} className="text-gray-500">{p.asset} {p.direction} @ ${p.entry_price.toFixed(2)}</p>
                      ))}
                    </div>
                  </div>
                )}
                {s.esperimenti.intraday_shadow && (
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-4">
                    <div className="font-bold mb-2">{t('aureus.expIntraday')}</div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>{s.esperimenti.intraday_shadow.chiusi} {t('aureus.expClosed')}</p>
                      <p className={pnlColor(s.esperimenti.intraday_shadow.netto_usd)}>
                        {t('aureus.expNet')}: {fmtUsd(s.esperimenti.intraday_shadow.netto_usd)}
                      </p>
                      <p className="text-gray-500">{t('aureus.expIntradayNote')}</p>
                    </div>
                  </div>
                )}
                {s.esperimenti.funding_disp && (
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-4">
                    <div className="font-bold mb-2">{t('aureus.expFdisp')}</div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>{s.esperimenti.funding_disp.osservazioni.toLocaleString()} {t('aureus.expObs')} · {s.esperimenti.funding_disp.aperte.length} {t('aureus.expOpen')} · {s.esperimenti.funding_disp.chiuse_v2} {t('aureus.expClosed')}</p>
                      <p className={pnlColor(s.esperimenti.funding_disp.netto_v2_usd)}>
                        {t('aureus.expNet')}: {fmtUsd(s.esperimenti.funding_disp.netto_v2_usd)} (${s.esperimenti.funding_disp.nozionale_gamba}/leg)
                      </p>
                      {s.esperimenti.funding_disp.aperte.slice(0, 4).map((p) => (
                        <p key={p.asset} className="text-gray-500">
                          {p.asset}: {p.long} → {p.short} · {fmtUsd(p.accrued_usd, 3)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="font-bold mb-2">{t('aureus.expOther')}</div>
                  <div className="text-xs text-gray-400 space-y-1">
                    {s.esperimenti.twin_lb && (
                      <p>{t('aureus.expTsmomLb')}: {s.esperimenti.twin_lb.aperti} {t('aureus.expOpen')} · {s.esperimenti.twin_lb.chiusi} {t('aureus.expClosed')} · {fmtUsd(s.esperimenti.twin_lb.netto_usd)}</p>
                    )}
                    {s.esperimenti.twin_trail && (
                      <p>{t('aureus.expTrail')}: {s.esperimenti.twin_trail.chiusi} {t('aureus.expClosed')} · {fmtUsd(s.esperimenti.twin_trail.netto_usd)}</p>
                    )}
                    {s.esperimenti.short_sleeve && (
                      <p>{t('aureus.expShortSleeve')}: {s.esperimenti.short_sleeve.aperti.length} {t('aureus.expOpen')} · {s.esperimenti.short_sleeve.chiusi} {t('aureus.expClosed')} · <span className={pnlColor(s.esperimenti.short_sleeve.netto_usd)}>{fmtUsd(s.esperimenti.short_sleeve.netto_usd)}</span></p>
                    )}
                    {s.esperimenti.cascade_sig && (
                      <p>{t('aureus.expCascadeSig')}: {s.esperimenti.cascade_sig.chiusi} {t('aureus.expClosed')} · {fmtUsd(s.esperimenti.cascade_sig.netto_usd)}</p>
                    )}
                    {s.esperimenti.cascade_liq && (
                      <p>{t('aureus.expCascadeLiq')}: {s.esperimenti.cascade_liq.chiusi} {t('aureus.expClosed')} · {fmtUsd(s.esperimenti.cascade_liq.netto_usd)}</p>
                    )}
                    {s.esperimenti.quality_ls && (
                      <p>{t('aureus.expQualityLs')}: {s.esperimenti.quality_ls.aperti} {t('aureus.expOpen')} · {s.esperimenti.quality_ls.chiusi} {t('aureus.expClosed')} · <span className={pnlColor(s.esperimenti.quality_ls.netto_usd)}>{fmtUsd(s.esperimenti.quality_ls.netto_usd)}</span></p>
                    )}
                    {s.esperimenti.memoria_asset && Object.keys(s.esperimenti.memoria_asset).length > 0 ? (
                      <>
                        <p className="pt-1">{t('aureus.expMemAsset')} ({t('aureus.expSamples')} {s.esperimenti.memoria_min_campioni ?? 25}):</p>
                        {Object.entries(s.esperimenti.memoria_asset).slice(0, 5).map(([k, n]) => (
                          <p key={k} className="text-gray-500">{k.replace('/@', ' @').replace('/', ' ')} · {n}</p>
                        ))}
                      </>
                    ) : (
                      <p className="pt-1 text-gray-500">{t('aureus.expMemAsset')}: {t('aureus.expNoData')}</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="mb-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold">{t('aureus.history')}</h2>
              <div className="flex gap-2">
                {(['today', '7d', '30d', 'all'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      filter === f
                        ? 'bg-gray-200 text-gray-900 border-gray-200'
                        : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {f === 'today' ? t('aureus.today') : f === '7d' ? t('aureus.days7') : f === '30d' ? t('aureus.days30') : t('aureus.all')}
                  </button>
                ))}
              </div>
            </div>

            {filteredTrades.length === 0 ? (
              <p className="text-sm text-gray-500">{t('aureus.noTradesPeriod')}</p>
            ) : (
              <div className="space-y-2">
                {filteredTrades.map((t, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedTrade(t)}
                    className={`flex justify-between items-center border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                      t.liquidated
                        ? 'border-red-800 bg-red-950/30 hover:bg-red-950/50'
                        : 'border-gray-800 hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{t.asset}</span>
                      {t.liquidated && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-700 text-white">LIQ</span>
                      )}
                      <span className={`text-xs uppercase px-2 py-0.5 rounded ${
                        t.direction === 'long' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                      }`}>
                        {t.direction}
                      </span>
                      {t.verified && (
                        <span className="text-[11px] text-emerald-500">✓</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">
                        {t.closed_at ? new Date(t.closed_at * 1000).toLocaleDateString() : '-'}
                      </span>
                      <span className={`font-bold ${t.pnl_usd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmtUsd(t.pnl_usd)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-600 mt-3">
              {filteredTrades.length} {t('aureus.tradesShown')}{' '}
              {new Date(s.updated * 1000).toLocaleString()}
              {s.lifetime_pnl_usd !== undefined && ` · ${t('aureus.lifetimePnl')} ${fmtUsd(s.lifetime_pnl_usd)}`}
            </p>
          </section>
          </details>
          )}
        </>
      )}

      {selectedTrade && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTrade(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold">{selectedTrade.asset}</h3>
                <p className="text-sm text-gray-400">
                  {selectedTrade.direction?.toUpperCase()} · {selectedTrade.verified ? '✓ Verified' : 'Not verified'}
                </p>
              </div>
              <button
                onClick={() => setSelectedTrade(null)}
                className="text-gray-400 hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[11px] uppercase text-gray-500 mb-1">{t('aureus.pnlLabel')}</p>
                <p className={`text-xl font-bold ${selectedTrade.pnl_usd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtUsd(selectedTrade.pnl_usd)}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[11px] uppercase text-gray-500 mb-1">{t('aureus.returnLabel')}</p>
                <p className="text-xl font-bold text-gray-200">
                  {selectedTrade.entry_price && selectedTrade.exit_price
                    ? `${((selectedTrade.exit_price / selectedTrade.entry_price - 1) * (selectedTrade.direction === 'short' ? -1 : 1) * 100).toFixed(2)}%`
                    : '-'}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[11px] uppercase text-gray-500 mb-1">{t('aureus.entryLabel')}</p>
                <p className="text-lg font-semibold">${selectedTrade.entry_price?.toFixed(4) || '-'}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[11px] uppercase text-gray-500 mb-1">{t('aureus.exitLabel')}</p>
                <p className="text-lg font-semibold">${selectedTrade.exit_price?.toFixed(4) || '-'}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[11px] uppercase text-gray-500 mb-1">{t('aureus.sizeLabel')}</p>
                <p className="text-lg font-semibold">${selectedTrade.size_usd?.toFixed(2) || '-'}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[11px] uppercase text-gray-500 mb-1">{t('aureus.durationLabel')}</p>
                <p className="text-lg font-semibold">
                  {selectedTrade.opened_at && selectedTrade.closed_at
                    ? formatDuration(selectedTrade.closed_at - selectedTrade.opened_at)
                    : '-'}
                </p>
              </div>
            </div>

            {selectedTrade.catalyst && (
              <div className="mb-4">
                <p className="text-[11px] uppercase text-gray-500 mb-2">{t('aureus.catalystLabel')}</p>
                <p className="text-sm text-gray-300 bg-white/5 rounded-lg p-3">{selectedTrade.catalyst}</p>
              </div>
            )}

            {selectedTrade.conviction !== undefined && (
              <div className="mb-4">
                <p className="text-[11px] uppercase text-gray-500 mb-2">{t('aureus.convictionLabel')}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${selectedTrade.conviction * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{(selectedTrade.conviction * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}

            {selectedTrade.commit_hash && (
              <div className="mb-4">
                <p className="text-[11px] uppercase text-gray-500 mb-2">{t('aureus.commitHashLabel')}</p>
                <p className="text-xs font-mono text-gray-400 break-all">{selectedTrade.commit_hash}</p>
              </div>
            )}

            {selectedTrade.opened_at && selectedTrade.closed_at && (
              <div className="text-xs text-gray-500 grid grid-cols-2 gap-2 pt-4 border-t border-gray-800">
                <span>{t('aureus.opened')} {new Date(selectedTrade.opened_at * 1000).toLocaleString()}</span>
                <span>{t('aureus.closedAt')} {new Date(selectedTrade.closed_at * 1000).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="text-xs text-gray-600 pt-10 mt-10 border-t border-gray-800">
        {t('aureus.poweredBy')}
      </footer>
      </main>
  );
}

function isIntradayReport(report: IntradayExperiment | undefined): report is IntradayReport {
  return Boolean(report && 'equity_mtm_usd' in report && report.dry_run === true
    && [report.updated, report.since, report.start_capital_usd, report.equity_mtm_usd,
      report.net_pnl_usd, report.realized_pnl_usd, report.open_count, report.closed_count,
      report.estimated_costs_usd, report.funding_pnl_usd, report.max_drawdown_pct,
      report.maximum_loss_usd].every(Number.isFinite)
    && report.updated > 0 && report.start_capital_usd > 0
    && Array.isArray(report.open_positions));
}

function IntradaySummary({ report, now, fetchFailed }: {
  report: IntradayExperiment | undefined; now: number | null; fetchFailed: boolean;
}) {
  const { t, language } = useT();
  if (!isIntradayReport(report)) {
    return (
      <section className="mb-8 rounded-xl border border-amber-800 bg-amber-950/20 p-6">
        <h2 className="text-xl font-semibold">{t('aureus.intradayHeading')}</h2>
        <p className="mt-2 text-sm text-amber-300" role="status">{t('aureus.intradayUnavailable')}</p>
      </section>
    );
  }
  const age = now === null ? null : now - report.updated;
  // The publisher runs every five minutes; the CDN may retain one extra minute.
  const delayed = fetchFailed || report.stale === true || report.data_complete !== true
    || Boolean(report.last_error) || age === null || age < -5 || age > 600;
  const halted = Boolean(report.halt_reason || report.session_halted);
  const openPnl = report.net_pnl_usd - report.realized_pnl_usd;
  const timestamp = (value: number) => new Intl.DateTimeFormat(language, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    second: '2-digit', timeZone: 'Europe/Rome', timeZoneName: 'short',
  }).format(new Date(value * 1000));
  const equity = report.equity_mtm_usd;
  const start = report.start_capital_usd;
  const floor = Math.max(0, start - report.maximum_loss_usd);
  const top = Math.max(start * 1.1, equity * 1.02);
  const pos = (value: number) => `${Math.min(100, Math.max(0, ((value - floor) / (top - floor)) * 100))}%`;
  const up = report.net_pnl_usd >= 0;
  const daily = Object.entries(report.daily_results ?? {}).sort((x, y) => Number(x[0]) - Number(y[0])).slice(-30);
  const dayMax = Math.max(0.01, ...daily.map(([, row]) => Math.abs(row.net_pnl_usd)));
  const closed = [...(report.closed_trades ?? [])].sort((x, y) => y.closed_at - x.closed_at);
  const price = (value: number | null | undefined) => (value == null ? '\u2014' : value >= 1000 ? value.toFixed(1) : value >= 10 ? value.toFixed(2) : value.toFixed(4));
  const statusTone = halted ? 'red' : delayed ? 'amber' : 'emerald';
  const dot = { red: 'bg-red-400', amber: 'bg-amber-400', emerald: 'bg-emerald-400' }[statusTone];
  const pill = { red: 'border-red-800 text-red-300', amber: 'border-amber-800 text-amber-300',
    emerald: 'border-emerald-800 text-emerald-300' }[statusTone];
  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-black shadow-[0_0_60px_-30px_rgba(59,130,246,0.6)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4 sm:px-7">
        <h2 className="text-lg font-semibold tracking-tight">{t('aureus.intradayHeading')}</h2>
        <span role="status" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${dot} ${statusTone === 'emerald' ? 'animate-pulse' : ''}`} />
          {halted ? t('aureus.intradayHalted') : delayed
            ? t('aureus.intradayDelayed') : t('aureus.intradayAvailable')}
        </span>
      </div>
      <div className="px-5 py-6 sm:px-7">
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-gray-400">{t('aureus.intradayNote')}</p>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">{t('aureus.intradayEquity')}</p>
            <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">${equity.toFixed(2)}</p>
          </div>
          <div className={`rounded-xl border px-4 py-3 text-right ${up
            ? 'border-emerald-800/60 bg-emerald-950/30' : 'border-red-900/60 bg-red-950/30'}`}>
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">{t('aureus.intradayNet')}</p>
            <p className={`text-2xl font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
              {up ? '\u25B2 ' : '\u25BC '}{fmtUsd(report.net_pnl_usd)}
              <span className="ml-2 text-sm font-medium opacity-80">{fmtPct(report.net_pnl_usd / start)}</span>
            </p>
          </div>
        </div>
        <div className="mt-7" aria-hidden="true">
          <div className="relative h-2 rounded-full bg-white/10">
            <div className={`absolute inset-y-0 left-0 rounded-full ${up ? 'bg-emerald-500/70' : 'bg-red-500/70'}`}
              style={{ width: pos(equity) }} />
            <div className="absolute -top-1 h-4 w-px bg-white/60" style={{ left: pos(start) }} />
          </div>
          <div className="mt-2 flex justify-between text-[10px] tabular-nums text-gray-500">
            <span>${floor.toFixed(0)} {t('aureus.intradayLossLimit').toLowerCase()}</span>
            <span>${start.toFixed(0)} {t('aureus.intradayInitial').toLowerCase()}</span>
          </div>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={t('aureus.intradayRealized')} value={fmtUsd(report.realized_pnl_usd)}
            tone={report.realized_pnl_usd >= 0 ? 'pos' : 'neg'} />
          <Stat label={t('aureus.intradayOpenPnl')} value={fmtUsd(openPnl)} tone={openPnl >= 0 ? 'pos' : 'neg'} />
          <Stat label={t('aureus.intradayClosedCount')} value={String(report.closed_count)} />
          <Stat label={t('aureus.intradayOpenCount')} value={String(report.open_count)} />
          <Stat label={t('aureus.intradayCosts')} value={`$${report.estimated_costs_usd.toFixed(2)}`} />
          <Stat label={t('aureus.intradayDrawdown')} value={`${(report.max_drawdown_pct * 100).toFixed(2)}%`} />
        </div>
        {daily.length > 1 && (
          <div className="mt-7" aria-hidden="true">
            <div className="flex h-16 items-center gap-1.5">
              {daily.map(([day, row]) => (
                <div key={day} className="flex h-full flex-1 flex-col justify-center" title={`${new Date(Number(day) * 86400000).toISOString().slice(0, 10)}: ${fmtUsd(row.net_pnl_usd)}`}>
                  <div className="flex h-1/2 items-end">
                    {row.net_pnl_usd >= 0 && <div className="w-full rounded-t bg-emerald-500/70" style={{ height: `${Math.max(6, (row.net_pnl_usd / dayMax) * 100)}%` }} />}
                  </div>
                  <div className="flex h-1/2 items-start">
                    {row.net_pnl_usd < 0 && <div className="w-full rounded-b bg-red-500/70" style={{ height: `${Math.max(6, (-row.net_pnl_usd / dayMax) * 100)}%` }} />}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-gray-500">{daily.length}d · UTC</p>
          </div>
        )}
        <div className="mt-7 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-gray-400">
          <span className="text-gray-300">Where the P&amp;L comes from:</span>{' '}
          before costs and funding {fmtUsd(report.pnl_before_cost_and_funding_usd ?? report.net_pnl_usd + report.estimated_costs_usd - report.funding_pnl_usd)}
          {' · '}estimated trading costs {fmtUsd(-report.estimated_costs_usd)}
          {' · '}funding {fmtUsd(report.funding_pnl_usd, 4)}
          {' = '}net {fmtUsd(report.net_pnl_usd)}.
          {report.profit_factor != null && <> Profit factor {report.profit_factor.toFixed(2)} over {report.closed_count} closed trades.</>}
        </div>
        <h3 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-gray-300">
          Open positions ({report.open_positions.length})
        </h3>
        {report.open_positions.length === 0 ? (
          <p className="text-sm text-gray-500">No open position right now.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full min-w-[820px] text-left text-xs tabular-nums">
              <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.1em] text-gray-500">
                <tr>{['Asset', 'Side', 'Opened', 'Entry', 'Mark', 'Stop', 'Target', 'Margin', 'Notional', 'Unrealised P&L'].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>))}</tr>
              </thead>
              <tbody>
                {report.open_positions.map((position) => {
                  const short = position.direction.toLowerCase() === 'short';
                  const pnl = position.unrealized_pnl_usd;
                  return (
                    <tr key={`${position.asset}-${position.opened_at}`} className="border-t border-white/5">
                      <td className="px-3 py-2 font-semibold text-gray-100">{position.asset}</td>
                      <td className={`px-3 py-2 font-medium ${short ? 'text-rose-300' : 'text-emerald-300'}`}>{position.direction.toUpperCase()}</td>
                      <td className="px-3 py-2 text-gray-400">{timestamp(position.opened_at)}</td>
                      <td className="px-3 py-2">{price(position.entry_price)}</td>
                      <td className="px-3 py-2">{price(position.last_mark_price)}</td>
                      <td className="px-3 py-2">{price(position.protective_stop_price)}</td>
                      <td className="px-3 py-2">{price(position.session_target_price)}</td>
                      <td className="px-3 py-2">{position.size_usd != null ? `$${position.size_usd.toFixed(2)}` : '\u2014'}</td>
                      <td className="px-3 py-2">{position.notional_usd != null ? `$${position.notional_usd.toFixed(2)}${position.leverage ? ` (${position.leverage}x)` : ''}` : '\u2014'}</td>
                      <td className={`px-3 py-2 font-medium ${pnl == null ? 'text-gray-500' : pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pnl == null ? '\u2014' : fmtUsd(pnl)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <h3 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-gray-300">
          Closed trades ({report.closed_count})
        </h3>
        {closed.length === 0 ? (
          <p className="text-sm text-gray-500">No closed trade history in the public feed yet.</p>
        ) : (
          <>
            <div className="max-h-[520px] overflow-auto rounded-xl border border-white/5">
              <table className="w-full min-w-[900px] text-left text-xs tabular-nums">
                <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase tracking-[0.1em] text-gray-500">
                  <tr>{['Closed', 'Asset', 'Side', 'Entry', 'Exit', 'Margin', 'Held', 'Costs', 'Funding', 'Net P&L', 'Exit reason'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>))}</tr>
                </thead>
                <tbody>
                  {closed.map((trade) => {
                    const short = trade.direction.toLowerCase() === 'short';
                    return (
                      <tr key={`${trade.asset}-${trade.opened_at}-${trade.closed_at}`} className="border-t border-white/5">
                        <td className="px-3 py-2 text-gray-400">{timestamp(trade.closed_at)}</td>
                        <td className="px-3 py-2 font-semibold text-gray-100">{trade.asset}</td>
                        <td className={`px-3 py-2 font-medium ${short ? 'text-rose-300' : 'text-emerald-300'}`}>{trade.direction.toUpperCase()}</td>
                        <td className="px-3 py-2">{price(trade.entry_price)}</td>
                        <td className="px-3 py-2">{price(trade.exit_price)}</td>
                        <td className="px-3 py-2">${trade.size_usd.toFixed(2)}{trade.leverage ? ` (${trade.leverage}x)` : ''}</td>
                        <td className="px-3 py-2">{trade.hold_hours != null ? `${trade.hold_hours.toFixed(1)} h` : '\u2014'}</td>
                        <td className="px-3 py-2 text-gray-400">{trade.cost_usd != null ? fmtUsd(-trade.cost_usd) : '\u2014'}</td>
                        <td className="px-3 py-2 text-gray-400">{trade.funding_pnl_usd != null ? fmtUsd(trade.funding_pnl_usd, 4) : '\u2014'}</td>
                        <td className={`px-3 py-2 font-medium ${trade.pnl_usd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtUsd(trade.pnl_usd)}</td>
                        <td className="px-3 py-2 text-gray-400">{(trade.exit_reason ?? '').replace(/-/g, ' ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-gray-500">
              Most recent first, up to 200 trades. Net P&amp;L is after the estimated round-trip cost; funding is shown separately.
            </p>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-1 border-t border-white/5 bg-black/30 px-5 py-3 text-xs text-gray-500 sm:px-7">
        <p>{t('aureus.intradayFunding')}: {fmtUsd(report.funding_pnl_usd, 4)}</p>
        <p>{t('aureus.intradayStarted')}: <time dateTime={new Date(report.since * 1000).toISOString()}>{timestamp(report.since)}</time></p>
        <p>{t('aureus.intradayUpdated')}: <time dateTime={new Date(report.updated * 1000).toISOString()}>{timestamp(report.updated)}</time></p>
      </div>
    </section>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'pos' | 'neg'; hint?: string }) {
  const color = tone === 'pos' ? 'text-emerald-400' : tone === 'neg' ? 'text-red-400' : 'text-gray-100';
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] leading-tight text-gray-500">{hint}</p>}
    </div>
  );
}
