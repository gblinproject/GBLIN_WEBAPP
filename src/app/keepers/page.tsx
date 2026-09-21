'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';

/**
 * Rebalance leaderboard.
 *
 * Bounties are read from the amount carried by the `Rebalanced` event, never inferred from the
 * number of calls multiplied by an assumed rate: an estimate published as a measurement is a false
 * measurement. Executors that are operated by the protocol are flagged, so that the table never
 * presents protocol activity as third-party activity.
 */
interface RebalanceEvent {
  executor: string;
  executorIsOurs?: boolean;
  /** Bounty paid, in wei; `null` for events emitted by a previous contract, which omitted it. */
  bounty?: string | null;
  contract?: string;
}

interface KeeperRow {
  executor: string;
  rebalances: number;
  earnedEth: number;
  /** True when at least one rebalance carries no bounty amount, so the total is a lower bound. */
  earnedIncomplete: boolean;
  isOurs: boolean;
}

export default function KeepersPage() {
  const [rows, setRows] = useState<KeeperRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRebalances, setTotalRebalances] = useState(0);
  /**
   * The route reports `partial` when the source for the full history is unavailable and only a
   * recent window could be read. The flag must reach the interface: without it an unreadable
   * source renders as "no rebalances yet", which states the opposite of what is known.
   */
  const [partial, setPartial] = useState(false);
  const [coverage, setCoverage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Events, not transactions: only the event carries the bounty that was actually paid.
        const res = await fetch('/api/rebalance-history?limit=200');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `rebalance-history HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data?.degraded) {
          throw new Error('the log source could not be read right now');
        }
        const events: RebalanceEvent[] = data.events || [];
        setPartial(Boolean(data.partial));
        setCoverage(typeof data.covers === 'string' ? data.covers : null);

        const tally: Record<string, { n: number; wei: bigint; incomplete: boolean; operated: boolean }> = {};
        for (const ev of events) {
          const executor = ev.executor;
          if (!executor) continue;
          const row = tally[executor] ?? {
            n: 0,
            wei: 0n,
            incomplete: false,
            operated: Boolean(ev.executorIsOurs),
          };
          row.n += 1;
          if (ev.bounty) {
            try {
              row.wei += BigInt(ev.bounty);
            } catch {
              row.incomplete = true;
            }
          } else {
            // No bounty in the event: the amount is reported as missing rather than assumed.
            row.incomplete = true;
          }
          tally[executor] = row;
        }

        const ranked: KeeperRow[] = Object.entries(tally)
          .map(([executor, v]) => ({
            executor,
            rebalances: v.n,
            earnedEth: Number(ethers.formatEther(v.wei)),
            earnedIncomplete: v.incomplete,
            isOurs: v.operated,
          }))
          .sort((a, b) => b.rebalances - a.rebalances);

        setRows(ranked);
        setTotalRebalances(events.length);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message || 'Failed to load keeper data');
        setLoading(false);
      }
    }
    load();
  }, []);

  const short = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  // Sum of the bounties actually paid. When an event carries no amount the total is a lower bound,
  // and the interface states that instead of rounding the gap away.
  const totalEth = rows.reduce((acc, r) => acc + r.earnedEth, 0);
  const incomplete = rows.some((r) => r.earnedIncomplete);

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '48px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>GBLIN Rebalance Leaderboard</h1>
      <p style={{ color: '#666', marginBottom: 32, lineHeight: 1.5 }}>
        The vault in service rebalances through a <strong>Dutch auction</strong>: when a row drifts past its
        band, anyone can trade with the vault toward the target weights at the oracle price adjusted by a
        premium that rises over an hour, up to 0.25%. The premium is the whole reward — nothing is paid out of
        the vault, and the bidder brings the tokens. The previous contracts worked differently: they paid an
        adaptive bounty from a buffer to whoever called their rebalance function, and that history is kept
        below with the bounty each address was actually paid, read from the <code>Rebalanced</code> event.
        Auction fills on the vault in service appear here too, read from <code>AuctionFill</code>, with no
        bounty column because none exists. Executors operated by the protocol are flagged; the list is
        published in the <a href="/promises/P2-honest-counters.json">honest-counters promise</a>, so the
        split between protocol activity and third-party activity can be reproduced from the chain.
      </p>

      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ padding: '16px 24px', border: '1px solid #e5e5e5', borderRadius: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{totalRebalances}</div>
          <div style={{ color: '#888', fontSize: 13 }}>
            {partial ? 'rebalances in the window that could be read' : 'total rebalances'}
          </div>
        </div>
        <div style={{ padding: '16px 24px', border: '1px solid #e5e5e5', borderRadius: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{rows.filter((r) => !r.isOurs).length}</div>
          <div style={{ color: '#888', fontSize: 13 }}>
            third-party keepers
            {rows.some((r) => r.isOurs)
              ? ` (+${rows.filter((r) => r.isOurs).length} operated by the protocol)`
              : ''}
          </div>
        </div>
        <div style={{ padding: '16px 24px', border: '1px solid #e5e5e5', borderRadius: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {totalEth.toFixed(5)} ETH{incomplete ? '+' : ''}
          </div>
          <div style={{ color: '#888', fontSize: 13 }}>
            bounties actually paid{incomplete ? ' — the older contract did not emit the amount' : ''}
          </div>
        </div>
      </div>

      {!loading && partial && rows.length > 0 && (
        <p
          style={{
            padding: '12px 16px',
            marginBottom: 24,
            border: '1px solid #e8d48a',
            background: '#fdf8e6',
            borderRadius: 10,
            fontSize: 13,
            color: '#6b5a12',
          }}
        >
          Partial view: the explorer that serves the full history is not answering, so these numbers cover
          only {coverage ?? 'a short recent window'}. Older rebalances are missing from this table, not
          from the chain.
        </p>
      )}

      {loading && <p>Loading on-chain keeper activity...</p>}
      {error && <p style={{ color: '#c00' }}>Error: {error}</p>}

      {!loading && !error && rows.length === 0 && partial && (
        <div style={{ padding: 32, border: '1px dashed #ccc', borderRadius: 12 }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>
            The full history could not be read right now.
          </p>
          <p style={{ color: '#666' }}>
            The block explorer that serves the complete log is not answering, so only a short recent
            window was read, and it contains no rebalances. That is not the same as &ldquo;nobody has ever
            rebalanced&rdquo; — the leaderboard fills back in once the source recovers.
          </p>
        </div>
      )}

      {!loading && !error && rows.length === 0 && !partial && (
        <div style={{ padding: 32, border: '1px dashed #ccc', borderRadius: 12, textAlign: 'center' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No rebalances recorded yet.</p>
          <p style={{ color: '#666' }}>
            The auction state is published at <code>/api/cron/rebalance</code>; bids are placed on the vault
            with{' '}<code>bid(index, vaultBuysAsset, amountIn, minOut, data)</code> for as long as the premium
            covers the cost of the trade.
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e5e5' }}>
              <th style={{ padding: '12px 8px' }}>#</th>
              <th style={{ padding: '12px 8px' }}>Keeper</th>
              <th style={{ padding: '12px 8px' }}>Rebalances</th>
              <th style={{ padding: '12px 8px' }}>Earned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.executor} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 8px' }}>{i + 1}</td>
                <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>
                  <a href={`https://basescan.org/address/${r.executor}`} target="_blank" rel="noreferrer">
                    {short(r.executor)}
                  </a>
                  {r.isOurs && (
                    <span
                      style={{
                        marginLeft: 8,
                        padding: '2px 8px',
                        borderRadius: 999,
                        border: '1px solid #d8b400',
                        color: '#8a7200',
                        fontSize: 11,
                        fontFamily: 'system-ui, sans-serif',
                      }}
                    >
                      run by GBLIN
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 8px' }}>{r.rebalances}</td>
                <td style={{ padding: '12px 8px' }}>
                  {/* A previous contract did not emit the amount: rendering "0 ETH" would state a
                      measurement that was never made, so the absence is labelled instead. */}
                  {r.earnedEth === 0 && r.earnedIncomplete ? (
                    <span style={{ color: '#888' }} title="The older contract did not emit the bounty amount">
                      not recorded on-chain
                    </span>
                  ) : (
                    `${r.earnedEth.toFixed(5)} ETH${r.earnedIncomplete ? '+' : ''}`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ marginTop: 40, color: '#888', fontSize: 13, lineHeight: 1.6 }}>
        The auction state — whether it is open, the current premium, and the side and gap of each row — is
        published at <code>/api/cron/rebalance</code> and readable on-chain through the GBLIN Lens. The
        figures on this page are read live from Base mainnet. The reward is the premium over the oracle
        price, applied to the amount that closes the gap.
      </p>
    </main>
  );
}
