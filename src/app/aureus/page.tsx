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
  open_count: number;
  total_unrealized_pnl: number;
  open_positions: OpenPosition[];
  closed_count: number;
  win_rate: number;
  top_trades: Trade[];
  all_trades: Trade[];
  metrics?: Metrics;
};

async function getStats(): Promise<Stats | null> {
  try {
    const r = await fetch('/api/aureus', { cache: 'no-store' });
    const j = await r.json();
    return j?.stats || null;
  } catch {
    return null;
  }
}

function fmtUsd(n: number | null | undefined, decimals = 2) {
  if (n === null || n === undefined) return '—';
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(decimals);
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
  const [filter, setFilter] = useState<'today' | '7d' | '30d' | 'all'>('today');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats().then((data) => {
      setStats(data);
      setLoading(false);
    });
    const interval = setInterval(() => {
      getStats().then(setStats);
    }, 30000);
    return () => clearInterval(interval);
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
            <Stat label={t('aureus.realizedPnl')}
              value={fmtUsd(s.lifetime_pnl_usd ?? s.realized_pnl_usd)}
              tone={(s.lifetime_pnl_usd ?? s.realized_pnl_usd) >= 0 ? 'pos' : 'neg'} />
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
                    <span>{t('aureus.drawdownFromPeak')}</span>
                    <span className={(
                      (s.drawdown_from_peak_pct ?? 0) >= 0.10 ? 'text-red-400' :
                      (s.drawdown_from_peak_pct ?? 0) >= 0.05 ? 'text-amber-400' :
                      'text-emerald-400'
                    )}>
                      {((s.drawdown_from_peak_pct ?? 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (s.drawdown_from_peak_pct ?? 0) >= 0.10 ? 'bg-red-500' :
                        (s.drawdown_from_peak_pct ?? 0) >= 0.05 ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min((s.drawdown_from_peak_pct ?? 0) / 0.10 * 100, 100).toFixed(1)}%` }}
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
                  {selectedTrade.direction?.toUpperCase()} · {selectedTrade.verified ? '✓ Verificato' : 'Non verificato'}
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  const color = tone === 'pos' ? 'text-emerald-400' : tone === 'neg' ? 'text-red-400' : 'text-gray-100';
  return (
    <div className="bg-white/5 rounded-lg p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
