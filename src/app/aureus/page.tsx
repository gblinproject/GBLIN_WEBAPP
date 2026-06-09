export const dynamic = 'force-dynamic';

type Trade = { asset: string; pnl_usd: number; direction?: string; commit_hash?: string; verified?: boolean; closed_at?: number };
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
};

async function getStats(): Promise<Stats | null> {
  const base = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return null;
  try {
    const r = await fetch(`${base}/get/aureus:stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const j = await r.json();
    return j?.result ? (JSON.parse(j.result) as Stats) : null;
  } catch {
    return null;
  }
}

function fmtUsd(n: number) {
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);
}

export default async function AureusPage() {
  const s = await getStats();

  return (
    <main className="max-w-2xl mx-auto px-5 py-12 font-sans text-gray-200">
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

      {!s ? (
        <div className="border border-gray-800 rounded-lg p-6 text-gray-400">
          Nessun dato ancora. L&apos;agente pubblica le statistiche qui appena gira
          (richiede le variabili Upstash configurate).
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <Stat label="Capitale" value={`$${s.capital_usd.toFixed(0)}`} />
            <Stat label="P&L realizzato"
              value={fmtUsd(s.realized_pnl_usd)}
              tone={s.realized_pnl_usd >= 0 ? 'pos' : 'neg'} />
            <Stat label="Win rate" value={`${(s.win_rate * 100).toFixed(0)}%`} />
            <Stat label="Posizioni aperte" value={`${s.open_count}`} />
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
                      <span>Size ${p.size_usd.toFixed(2)}</span>
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

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Migliori trade (chiusi)</h2>
            {s.top_trades.length === 0 ? (
              <p className="text-sm text-gray-500">Ancora nessun trade chiuso.</p>
            ) : (
              <div className="space-y-2">
                {s.top_trades.map((t, i) => (
                  <div key={i}
                    className="flex justify-between items-center border border-gray-800 rounded-lg px-4 py-2">
                    <span className="font-medium">{t.asset}</span>
                    <span className="flex items-center gap-3">
                      {t.verified && (
                        <span className="text-[11px] text-emerald-500">✓ verificato</span>
                      )}
                      <span className={t.pnl_usd >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {fmtUsd(t.pnl_usd)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-xs text-gray-600">
            {s.closed_count} trade chiusi · aggiornato{' '}
            {new Date(s.updated * 1000).toLocaleString()}.
            {s.lifetime_pnl_usd !== undefined && ` P&L lifetime: ${fmtUsd(s.lifetime_pnl_usd)}.`}
          </p>
        </>
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
    <div className="bg-white/5 rounded-lg p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
