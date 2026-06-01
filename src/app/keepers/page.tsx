'use client';

import { useEffect, useState } from 'react';
import { createPublicClient, http, parseAbiItem, formatEther } from 'viem';
import { base } from 'viem/chains';

const GBLIN = '0x38DcDB3A381677239BBc652aed9811F2f8496345' as const;
const REWARD_ETH = 0.0001;
// Imposta al blocco di deploy reale del V5. Fallback prudente: restringere il range.
const DEPLOY_BLOCK = 0n;

const REBALANCED_EVENT = parseAbiItem(
  'event Rebalanced(address indexed executor, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)'
);

interface KeeperRow {
  executor: string;
  rebalances: number;
  earnedEth: number;
}

export default function KeepersPage() {
  const [rows, setRows] = useState<KeeperRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRebalances, setTotalRebalances] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const client = createPublicClient({
          chain: base,
          transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://base-rpc.publicnode.com'),
        });

        const latest = await client.getBlockNumber();
        // Query a bounded window to stay within public RPC limits
        const fromBlock = DEPLOY_BLOCK > 0n ? DEPLOY_BLOCK : (latest > 500000n ? latest - 500000n : 0n);

        const logs = await client.getLogs({
          address: GBLIN,
          event: REBALANCED_EVENT,
          fromBlock,
          toBlock: latest,
        });

        const tally: Record<string, number> = {};
        for (const log of logs) {
          const executor = (log.args as any).executor as string;
          if (!executor) continue;
          tally[executor] = (tally[executor] || 0) + 1;
        }

        const ranked: KeeperRow[] = Object.entries(tally)
          .map(([executor, rebalances]) => ({
            executor,
            rebalances,
            earnedEth: rebalances * REWARD_ETH,
          }))
          .sort((a, b) => b.rebalances - a.rebalances);

        setRows(ranked);
        setTotalRebalances(logs.length);
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
        the treasury pool earns {REWARD_ETH} ETH per call — the swap uses the contract&apos;s own funds, the keeper
        only pays gas. Below are the agents earning from it on-chain.
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
          <div style={{ fontSize: 28, fontWeight: 700 }}>{(totalRebalances * REWARD_ETH).toFixed(4)} ETH</div>
          <div style={{ color: '#888', fontSize: 13 }}>paid to keepers</div>
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
