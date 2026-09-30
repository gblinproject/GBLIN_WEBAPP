'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAccount } from 'wagmi';

type Simulation = {
  status: 'ok' | 'below_minimum' | 'nothing_to_park';
  usdc_in?: number;
  gblin_expected?: string;
  gblin_min?: string;
  position_value_usd?: number;
  fees?: {
    entry_swap_fee_bps: number;
    protocol_fee_bps: number;
    stability_fee_bps: number;
    mint_fee_usd: number;
    management_fee_bps_per_year: number;
    management_fee_usd_per_year: number;
  };
  exit_today?: { gross_usd: number; dex_fee_estimate_bps: number; net_estimate_usd: number; method: string };
  round_trip_cost_usd?: number;
  round_trip_cost_bps?: number;
  slippage_buffer_pct?: number;
  minimum_note?: string;
  reason?: string;
};

type Plan = {
  wallet: string;
  as_of: { block: string; unix: number };
  market: { nav_usd: number; eth_price_usd: number; regime: string; crash_shield_active: boolean };
  wallet_state: {
    usdc: string;
    gblin: string;
    gblin_value_usd: number;
    eth: string;
    gas_health: { status: string; exit_cost_eth: string };
    cooldown: { active: boolean; seconds_remaining: number };
  };
  operating_cash: { usdc: number; rule: string; runway_days: number | null };
  surplus: { usdc: number };
  park_candidate: boolean;
  blockers: string[];
  simulation: Simulation;
  trial: Simulation;
  next: { invest: string | null; invest_trial: string; jit: string; health: string };
  notes: string[];
};

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const usd = (n: number | undefined) =>
  n === undefined ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const gblin = (s: string | undefined) => (s === undefined ? '—' : `${Number(s).toFixed(4)} GBLIN`);
const bps = (n: number | undefined) => (n === undefined ? '—' : `${n} bps`);

function SimulationTable({ title, sim }: { title: string; sim: Simulation }) {
  if (sim.status === 'nothing_to_park') {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-5">
        <h3 className="text-base font-medium">{title}</h3>
        <p className="mt-2 text-sm text-white/60">{sim.reason}</p>
      </div>
    );
  }
  if (sim.status === 'below_minimum') {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-5">
        <h3 className="text-base font-medium">{title}</h3>
        <p className="mt-2 text-sm text-white/60">{sim.minimum_note}</p>
      </div>
    );
  }
  const rows: Array<[string, string]> = [
    ['USDC in', usd(sim.usdc_in)],
    ['Shares expected', gblin(sim.gblin_expected)],
    ['Minimum shares (slippage buffer applied)', gblin(sim.gblin_min)],
    ['Position value at NAV', usd(sim.position_value_usd)],
    ['Swap fee on the way in', bps(sim.fees?.entry_swap_fee_bps)],
    ['Mint fee (protocol + stability)', `${bps((sim.fees?.protocol_fee_bps ?? 0) + (sim.fees?.stability_fee_bps ?? 0))} · ${usd(sim.fees?.mint_fee_usd)}`],
    ['Management fee', `${bps(sim.fees?.management_fee_bps_per_year)} per year · ${usd(sim.fees?.management_fee_usd_per_year)} per year`],
    ['Exit today, gross at NAV', usd(sim.exit_today?.gross_usd)],
    ['Exit today, net estimate', `${usd(sim.exit_today?.net_estimate_usd)} (pool fees ≈ ${bps(sim.exit_today?.dex_fee_estimate_bps)})`],
    ['Round-trip cost today', `${usd(sim.round_trip_cost_usd)} · ${bps(sim.round_trip_cost_bps)}`],
  ];
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-5">
      <h3 className="text-base font-medium">{title}</h3>
      <dl className="mt-4 divide-y divide-white/10 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-x-4 py-2">
            <dt className="text-white/60">{k}</dt>
            <dd className="text-right tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {sim.exit_today?.method ? <p className="mt-3 text-xs text-white/40">{sim.exit_today.method}</p> : null}
    </div>
  );
}

export function TreasuryPlanner() {
  const { address } = useAccount();
  const [wallet, setWallet] = useState('');
  const [dailyBurn, setDailyBurn] = useState('25');
  const [days, setDays] = useState('7');
  const [reserve, setReserve] = useState('');
  const [trial, setTrial] = useState('100');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (address && !wallet) setWallet(address);
  }, [address, wallet]);

  async function run(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPlan(null);
    if (!ADDRESS_RE.test(wallet)) {
      setError('Enter a valid 0x address.');
      return;
    }
    if (!dailyBurn && !reserve) {
      setError('Enter a daily spend or a reserve, or both.');
      return;
    }
    const params = new URLSearchParams({ wallet });
    if (dailyBurn) params.set('daily_burn', dailyBurn);
    if (days) params.set('days', days);
    if (reserve) params.set('reserve', reserve);
    if (trial) params.set('trial', trial);
    setLoading(true);
    try {
      const res = await fetch(`/api/x402/plan?${params.toString()}`, { cache: 'no-store' });
      const body = (await res.json()) as Plan & { error?: string };
      if (!res.ok || body.error) {
        setError(body.error ?? `Request failed (${res.status}).`);
        return;
      }
      setPlan(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const field = 'mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-amber-400/60 focus:outline-none';

  return (
    <div>
      <form onSubmit={run} className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm text-white/70">
          Wallet address on Base
          <input
            className={`${field} font-mono`}
            value={wallet}
            onChange={(e) => setWallet(e.target.value.trim())}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label className="text-sm text-white/70">
          Daily spend (USD)
          <input className={field} value={dailyBurn} onChange={(e) => setDailyBurn(e.target.value)} inputMode="decimal" placeholder="25" />
        </label>
        <label className="text-sm text-white/70">
          Days of spend to keep liquid
          <input className={field} value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" placeholder="7" />
        </label>
        <label className="text-sm text-white/70">
          Reserve to keep regardless (USD, optional)
          <input className={field} value={reserve} onChange={(e) => setReserve(e.target.value)} inputMode="decimal" placeholder="500" />
        </label>
        <label className="text-sm text-white/70">
          Trial amount (USDC)
          <input className={field} value={trial} onChange={(e) => setTrial(e.target.value)} inputMode="decimal" placeholder="100" />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Reading the chain…' : 'Build the plan'}
          </button>
          <span className="text-xs text-white/50">Reads only. Nothing is signed or sent from this page.</span>
        </div>
        {error ? <p className="sm:col-span-2 text-sm text-red-300">{error}</p> : null}
      </form>

      {plan ? (
        <div className="mt-8 grid gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wide text-white/50">Operating cash</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{usd(plan.operating_cash.usdc)}</p>
              <p className="mt-1 text-xs text-white/50">{plan.operating_cash.rule}</p>
              {plan.operating_cash.runway_days !== null ? (
                <p className="mt-1 text-xs text-white/50">USDC on hand covers {plan.operating_cash.runway_days} days of spend.</p>
              ) : null}
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wide text-white/50">Surplus USDC</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{usd(plan.surplus.usdc)}</p>
              <p className="mt-1 text-xs text-white/50">Wallet holds {Number(plan.wallet_state.usdc).toFixed(2)} USDC and {gblin(plan.wallet_state.gblin)}.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wide text-white/50">Market</p>
              <p className="mt-2 text-2xl font-semibold capitalize">{plan.market.regime}</p>
              <p className="mt-1 text-xs text-white/50">
                NAV {usd(plan.market.nav_usd)} · ETH {usd(plan.market.eth_price_usd)} · shield {plan.market.crash_shield_active ? 'active' : 'idle'} · block {plan.as_of.block}
              </p>
            </div>
          </div>

          <div
            className={`rounded-lg border p-5 text-sm ${
              plan.park_candidate ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
            }`}
          >
            {plan.park_candidate ? (
              <p>No blocker applies: the surplus is a candidate for GBLIN. A candidate, not a recommendation: read the simulation, then decide.</p>
            ) : (
              <div>
                <p className="font-medium">Parking is not appropriate right now:</p>
                <ul className="mt-2 list-disc pl-5">
                  {plan.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SimulationTable title="Simulation for the surplus" sim={plan.simulation} />
            <SimulationTable title={`Trial: ${usd(plan.trial.usdc_in)}`} sim={plan.trial} />
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5 text-sm">
            <h3 className="text-base font-medium">If you confirm</h3>
            <p className="mt-2 text-white/60">
              Mint from the site with ETH at the same NAV, or hand the prepare endpoint to your agent: it returns unsigned calldata with the minimums above, and your wallet signs.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="/buy-gblin" className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90">
                Mint at NAV on the site
              </a>
              <a href="/agents" className="rounded-lg border border-white/20 px-5 py-2.5 text-sm transition hover:bg-white/5">
                Give it to an agent
              </a>
            </div>
            <dl className="mt-4 grid gap-2 text-xs text-white/50">
              {plan.next.invest ? (
                <div>
                  <dt className="text-white/40">Prepare the surplus mint</dt>
                  <dd className="break-all font-mono">{plan.next.invest}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-white/40">Prepare the trial mint</dt>
                <dd className="break-all font-mono">{plan.next.invest_trial}</dd>
              </div>
              <div>
                <dt className="text-white/40">Refill USDC just in time</dt>
                <dd className="break-all font-mono">{plan.next.jit}</dd>
              </div>
            </dl>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-xs text-white/50">
            {plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
