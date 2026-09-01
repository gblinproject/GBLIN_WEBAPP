'use client';

import { useEffect, useState } from 'react';

/* Client-side fetch of /api/observatory: the live block probes the Bazaar and
 * can be slow or unavailable — the page must render instantly with the dated
 * snapshot and upgrade to live numbers when (and only when) they exist. */

interface LiveData {
  total_listed: number;
  total_listed_source: string;
  fetched: number;
  sampled_reachability: {
    sampled: number;
    reachable: number;
    reachable_pct: number | null;
  };
  price_distribution: {
    priced_listings: number;
    median_usd: number;
    share_under_1_cent_pct: number;
  } | null;
  probed_at: string;
}

interface GblinVerified {
  stats: {
    total_paid_calls: number;
    total_unique_agents: number;
    total_usdc_earned: number;
  } | null;
}

interface ObservatoryPayload {
  live: LiveData | null;
  live_error?: string;
  gblin_verified?: GblinVerified;
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-zinc-300">{label}</p>
      {note ? <p className="mt-2 text-xs text-zinc-500">{note}</p> : null}
    </div>
  );
}

export function LiveSection() {
  const [data, setData] = useState<ObservatoryPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/observatory')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: ObservatoryPayload) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const live = data?.live ?? null;

  return (
    <>
      <h2 className="mt-12 text-xl font-semibold text-white">Live Bazaar probe</h2>
      {live ? (
        <>
          <p className="mt-2 text-sm leading-7 text-zinc-400">
            Probed directly from the Coinbase x402 Bazaar discovery API at{' '}
            {new Date(live.probed_at).toUTCString()} (cached up to 24h).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Services listed on the Bazaar"
              value={live.total_listed.toLocaleString('en-US')}
              note={
                live.total_listed_source === 'pagination_metadata'
                  ? 'From Bazaar pagination metadata'
                  : `Lower bound — counted across ${live.fetched.toLocaleString('en-US')} fetched listings`
              }
            />
            <StatCard
              label="Sampled endpoints reachable"
              value={
                live.sampled_reachability.reachable_pct !== null
                  ? `${live.sampled_reachability.reachable_pct}%`
                  : 'n/a'
              }
              note={`${live.sampled_reachability.reachable} of ${live.sampled_reachability.sampled} random listings answered with HTTP < 500 within 2.5s`}
            />
            {live.price_distribution ? (
              <StatCard
                label="Median listed price"
                value={`$${live.price_distribution.median_usd}`}
                note={`${live.price_distribution.share_under_1_cent_pct}% of ${live.price_distribution.priced_listings.toLocaleString('en-US')} priced listings ask under $0.01`}
              />
            ) : (
              <StatCard label="Price metadata" value="n/a" note="No price metadata in fetched listings" />
            )}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm leading-7 text-zinc-400">
          {failed || data
            ? 'Live probe currently unavailable — the numbers below are our last verified snapshot (2026-07-27). We never substitute fabricated live figures.'
            : 'Probing the Bazaar discovery API…'}
        </p>
      )}
    </>
  );
}

export function GblinNumbers() {
  const [stats, setStats] = useState<GblinVerified['stats']>(null);
  // Lo split interno/esterno e' il senso della promessa P2: pubblichiamo la lista dei nostri
  // wallet proprio perche' chiunque possa rifarlo. Farlo fare al lettore era scortese.
  const [split, setSplit] = useState<{
    organic_calls: number;
    organic_agents: number;
    organic_usdc: number;
    internal_calls: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/agent-stats')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: {
        total_paid_calls?: number;
        total_unique_agents?: number;
        total_usdc_earned?: number;
        organic?: { paid_calls?: number; unique_agents?: number; usdc?: number };
        internal?: { paid_calls?: number; unique_agents?: number };
      }) => {
        if (cancelled) return;
        setStats({
          total_paid_calls: Number(j.total_paid_calls ?? 0),
          total_unique_agents: Number(j.total_unique_agents ?? 0),
          total_usdc_earned: Number(j.total_usdc_earned ?? 0),
        });
        setSplit({
          organic_calls: Number(j.organic?.paid_calls ?? 0),
          organic_agents: Number(j.organic?.unique_agents ?? 0),
          organic_usdc: Number(j.organic?.usdc ?? 0),
          internal_calls: Number(j.internal?.paid_calls ?? 0),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) {
    return (
      <p className="mt-4 text-sm text-zinc-500">
        Loading on-chain numbers… (independently verifiable at any time via{' '}
        <a className="underline decoration-amber-500/40 underline-offset-4" href="/api/agent-stats">
          /api/agent-stats
        </a>
        )
      </p>
    );
  }

  return (
    <>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Paid x402 calls from external wallets"
          value={(split?.organic_calls ?? stats.total_paid_calls).toLocaleString('en-US')}
        />
        <StatCard
          label="External paying wallets"
          value={(split?.organic_agents ?? stats.total_unique_agents).toLocaleString('en-US')}
        />
        <StatCard
          label="USDC earned from external wallets"
          value={`$${(split?.organic_usdc ?? stats.total_usdc_earned).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          note="Every payment is a USDC transfer to the fee wallet on Base — verifiable on-chain"
        />
      </div>
      {split ? (
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Cumulative total including our own wallets:{' '}
          {stats.total_paid_calls.toLocaleString('en-US')} calls from{' '}
          {stats.total_unique_agents.toLocaleString('en-US')} wallets ($
          {stats.total_usdc_earned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}),
          of which {split.internal_calls.toLocaleString('en-US')} are ours. The wallet list is
          published in{' '}
          <a
            className="underline decoration-amber-500/40 underline-offset-4"
            href="/promises/P2-honest-counters.json"
          >
            promise P2
          </a>
          , so anyone can reproduce this split from the chain.
        </p>
      ) : null}
    </>
  );
}
