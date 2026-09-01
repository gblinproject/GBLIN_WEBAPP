'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x36C81d7E1966310F305eA637e761Cf77F90852f0';

// Conservative ESTIMATE per rebalance for the leaderboard totals.
// V6 pays an adaptive bounty (~0.05% of rebalanced volume, clamped 0.00005–0.01 ETH,
// max once/hour). TODO(domani): read the actual `bounty` emitted per Rebalanced event.
const REWARD_ETH = 0.0001;

// Selector di incentivizedRebalance(uint256,bool,uint256)
const REBALANCE_SELECTOR = ethers.id('incentivizedRebalance(uint256,bool,uint256)').slice(0, 10).toLowerCase();

interface KeeperRow {
  executor: string;
  rebalances: number;
  earnedEth: number;
}

interface ChainTx {
  hash: string;
  from_address: string;
  to_address: string;
  input: string;
  block_timestamp: string;
}

export default function KeepersPage() {
  const [rows, setRows] = useState<KeeperRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRebalances, setTotalRebalances] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        // Le transazioni arrivano dalla nostra rotta server (Alchemy), non piu' da Moralis
        // chiamata dal browser: dal 01/09/2026 il loro piano gratuito e' spento.
        const res = await fetch('/api/chain/contract-activity?limit=200');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `chain-activity HTTP ${res.status}`);
        }
        const data = await res.json();
        const allTxs: ChainTx[] = data.transactions || [];

        // Filter for incentivizedRebalance calls
        const tally: Record<string, number> = {};
        let rebalanceCount = 0;

        for (const tx of allTxs) {
          // Il selettore da solo non basta: conta solo se la chiamata era diretta al nostro
          // contratto, altrimenti una funzione omonima altrove finirebbe in classifica.
          if (tx.to_address?.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue;
          const selector = tx.input?.slice(0, 10)?.toLowerCase();
          if (selector === REBALANCE_SELECTOR) {
            const executor = tx.from_address;
            if (executor) {
              tally[executor] = (tally[executor] || 0) + 1;
              rebalanceCount++;
            }
          }
        }

        const ranked: KeeperRow[] = Object.entries(tally)
          .map(([executor, rebalances]) => ({
            executor,
            rebalances,
            earnedEth: rebalances * REWARD_ETH,
          }))
          .sort((a, b) => b.rebalances - a.rebalances);

        setRows(ranked);
        setTotalRebalances(rebalanceCount);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message || 'Failed to load keeper data');
        setLoading(false);
      }
    }
    load();
  }, []);

  const short = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '48px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>GBLIN Keeper Leaderboard</h1>
      <p style={{ color: '#666', marginBottom: 32, lineHeight: 1.5 }}>
        GBLIN is one of the few protocols on Base that <strong>pays AI agents</strong>. Anyone who rebalances
        the treasury pool earns an <strong>adaptive bounty</strong> — roughly 0.05% of the volume rebalanced,
        capped between 0.00005 and 0.01 ETH, paid only on a successful swap and at most once per hour. The swap
        uses the contract&apos;s own funds, the keeper only pays gas. Below are the agents earning from it on-chain.
      </p>

      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ padding: '16px 24px', border: '1px solid #e5e5e5', borderRadius: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{totalRebalances}</div>
          <div style={{ color: '#888', fontSize: 13 }}>total rebalances</div>
        </div>
        <div style={{ padding: '16px 24px', border: '1px solid #e5e5e5', borderRadius: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{rows.length}</div>
          <div style={{ color: '#888', fontSize: 13 }}>active keepers</div>
        </div>
        <div style={{ padding: '16px 24px', border: '1px solid #e5e5e5', borderRadius: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>~{(totalRebalances * REWARD_ETH).toFixed(4)} ETH</div>
          <div style={{ color: '#888', fontSize: 13 }}>paid to keepers (est.)</div>
        </div>
      </div>

      {loading && <p>Loading on-chain keeper activity...</p>}
      {error && <p style={{ color: '#c00' }}>Error: {error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: 32, border: '1px dashed #ccc', borderRadius: 12, textAlign: 'center' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No keepers yet. Be the first.</p>
          <p style={{ color: '#666' }}>
            Connect the GBLIN MCP server and call <code>find_keeper_bounty</code>, or read the
            {' '}<code>earn-as-base-keeper</code> skill to start earning.
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
                </td>
                <td style={{ padding: '12px 8px' }}>{r.rebalances}</td>
                <td style={{ padding: '12px 8px' }}>{r.earnedEth.toFixed(4)} ETH</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ marginTop: 40, color: '#888', fontSize: 13, lineHeight: 1.6 }}>
        Want to earn? Install the GBLIN MCP server (<code>@gblin-protocol/mcp-server</code>) and call
        {' '}<code>find_keeper_bounty</code>. Data read live from Base mainnet. Rewards depend on pool drift
        and available stability fund.
      </p>
    </main>
  );
}
