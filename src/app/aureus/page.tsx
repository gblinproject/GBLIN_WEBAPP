'use client';

import { useState, useMemo, useEffect } from 'react';

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
};
type OpenPosition = { asset: string; direction: string; entry_price: number; size_usd: number; catalyst: string; conviction: number; commit_hash: string; opened_at: number };
type Stats = {
  updated: number;
  dry_run: boolean;
  capital_usd: number;
  realized_pnl_usd: number;
  lifetime_pnl_usd: number;
  open_count: number;
  open_positions: OpenPosition[];
  closed_count: number;
  win_rate: number;
  top_trades: Trade[];
  all_trades: Trade[];
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

function fmtUsd(n: number) {
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function AureusPage() {
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

  const filteredTrades = useMemo(() => {
    if (!s?.all_trades) return [];
    const now = Date.now() / 1000;
    const days = filter === 'today' ? 1 : filter === '7d' ? 7 : filter === '30d' ? 30 : 36500;
    return s.all_trades
      .filter((t) => t.closed_at && (now - t.closed_at) < days * 86400)
      .sort((a, b) => (b.closed_at || 0) - (a.closed_at || 0));
  }, [s?.all_trades, filter]);

  const hallOfFame = useMemo(() => {
    if (!s?.all_trades?.length) return [];
    const byAsset = new Map<string, Trade[]>();
    s.all_trades.forEach((t) => {
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
        <h1 className="text-3xl font-bold">GBLIN Aureus</h1>
        {s && (
          <span className={`text-xs px-2 py-1 rounded ${s.dry_run
            ? 'bg-amber-900/40 text-amber-400 border border-amber-800'
            : 'bg-emerald-900/40 text-emerald-400 border border-emerald-800'}`}>
            {s.dry_run ? 'DRY-RUN (simulazione)' : 'LIVE'}
          </span>
        )}
      </div>
      <p className="text-gray-400 mb-10 leading-relaxed">
        Autonomous catalyst &amp; rotation agent on Base. Every thesis is committed
        on-chain before acting — performance you can verify, not screenshot.
      </p>

      {loading && (
        <div className="border border-gray-800 rounded-lg p-8 text-gray-400 text-center">
          Caricamento dati...
        </div>
      )}
      {!s && !loading && (
        <div className="border border-gray-800 rounded-lg p-8 text-gray-400 text-center">
          Nessun dato ancora. L&apos;agente pubblica le statistiche qui appena gira.
        </div>
      )}
      {s && (
        <>
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Stat label="Capitale" value={`$${s.capital_usd.toFixed(0)}`} />
            <Stat label="Allocato" value={`$${allocated.toFixed(0)} / $${s.capital_usd.toFixed(0)}`}
              tone={allocated >= s.capital_usd ? 'neg' : undefined} />
            <Stat label="P&L realizzato"
              value={fmtUsd(s.realized_pnl_usd)}
              tone={s.realized_pnl_usd >= 0 ? 'pos' : 'neg'} />
            <Stat label="Win rate" value={`${(s.win_rate * 100).toFixed(0)}%`} />
            <Stat label="Posizioni aperte" value={`${s.open_count}`} />
            <Stat label="Trade chiusi" value={`${s.closed_count}`} />
          </section>

          {s.open_positions && s.open_positions.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-3">Posizioni aperte</h2>
              <div className="space-y-2">
                {s.open_positions.map((p, i) => (
                  <div key={i}
                    className="border border-gray-800 rounded-lg px-4 py-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{p.asset}</span>
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                        p.direction === 'long'
                          ? 'bg-emerald-900/40 text-emerald-400'
                          : 'bg-red-900/40 text-red-400'
                      }`}>{p.direction}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 text-sm text-gray-400">
                      <span>Entry ${p.entry_price.toLocaleString()}</span>
                      <span>Collaterale ${p.size_usd.toFixed(0)} / ${s.capital_usd.toFixed(0)}</span>
                      <span>Conv {(p.conviction * 100).toFixed(0)}%</span>
                    </div>
                    {p.catalyst && (
                      <p className="mt-1.5 text-xs text-gray-500 italic truncate">{p.catalyst}</p>
                    )}
                    {p.commit_hash && (
                      <p className="mt-1 text-[10px] text-gray-600 font-mono truncate">
                        commit: {p.commit_hash.slice(0, 18)}...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {hallOfFame.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-4">Hall of Fame — Migliori per Asset</h2>
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
                      <p>{totalTrades} trade totali · P&L: {fmtUsd(totalPnl)}</p>
                      <p className="text-gray-500">Best: {best.direction} @ ${best.entry_price?.toFixed(2)}</p>
                    </div>
                    {best.verified && (
                      <span className="inline-block mt-2 text-[10px] text-emerald-500">✓ verificato</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mb-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold">Storico Trade</h2>
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
                    {f === 'today' ? 'Oggi' : f === '7d' ? '7 giorni' : f === '30d' ? '30 giorni' : 'Tutti'}
                  </button>
                ))}
              </div>
            </div>

            {filteredTrades.length === 0 ? (
              <p className="text-sm text-gray-500">Nessun trade nel periodo selezionato.</p>
            ) : (
              <div className="space-y-2">
                {filteredTrades.map((t, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedTrade(t)}
                    className="flex justify-between items-center border border-gray-800 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{t.asset}</span>
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
              {filteredTrades.length} trade visualizzati · aggiornato{' '}
              {new Date(s.updated * 1000).toLocaleString()}
              {s.lifetime_pnl_usd !== undefined && ` · P&L lifetime: ${fmtUsd(s.lifetime_pnl_usd)}`}
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
                <p className="text-[11px] uppercase text-gray-500 mb-1">P&L</p>
                <p className={`text-xl font-bold ${selectedTrade.pnl_usd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtUsd(selectedTrade.pnl_usd)}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[11px] uppercase text-gray-500 mb-1">Return</p>
                <p className="text-xl font-bold text-gray-200">
                  {selectedTrade.entry_price && selectedTrade.exit_price
                    ? `${((selectedTrade.exit_price / selectedTrade.entry_price - 1) * (selectedTrade.direction === 'short' ? -1 : 1) * 100).toFixed(2)}%`
                    : '-'}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[11px] uppercase text-gray-500 mb-1">Entry</p>
                <p className="text-lg font-semibold">${selectedTrade.entry_price?.toFixed(4) || '-'}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[11px] uppercase text-gray-500 mb-1">Exit</p>
                <p className="text-lg font-semibold">${selectedTrade.exit_price?.toFixed(4) || '-'}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[11px] uppercase text-gray-500 mb-1">Size</p>
                <p className="text-lg font-semibold">${selectedTrade.size_usd?.toFixed(2) || '-'}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[11px] uppercase text-gray-500 mb-1">Durata</p>
                <p className="text-lg font-semibold">
                  {selectedTrade.opened_at && selectedTrade.closed_at
                    ? formatDuration(selectedTrade.closed_at - selectedTrade.opened_at)
                    : '-'}
                </p>
              </div>
            </div>

            {selectedTrade.catalyst && (
              <div className="mb-4">
                <p className="text-[11px] uppercase text-gray-500 mb-2">Catalyst</p>
                <p className="text-sm text-gray-300 bg-white/5 rounded-lg p-3">{selectedTrade.catalyst}</p>
              </div>
            )}

            {selectedTrade.conviction !== undefined && (
              <div className="mb-4">
                <p className="text-[11px] uppercase text-gray-500 mb-2">Conviction</p>
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
                <p className="text-[11px] uppercase text-gray-500 mb-2">Commit Hash</p>
                <p className="text-xs font-mono text-gray-400 break-all">{selectedTrade.commit_hash}</p>
              </div>
            )}

            {selectedTrade.opened_at && selectedTrade.closed_at && (
              <div className="text-xs text-gray-500 grid grid-cols-2 gap-2 pt-4 border-t border-gray-800">
                <span>Aperto: {new Date(selectedTrade.opened_at * 1000).toLocaleString()}</span>
                <span>Chiuso: {new Date(selectedTrade.closed_at * 1000).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="text-xs text-gray-600 pt-10 mt-10 border-t border-gray-800">
        Powered by GBLIN Protocol · Base mainnet
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
