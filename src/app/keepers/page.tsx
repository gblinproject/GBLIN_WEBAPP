'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';

/**
 * 01/09/2026 — questa pagina contava le CHIAMATE a incentivizedRebalance e moltiplicava per
 * una stima fissa di 0,0001 ETH. Due cose erano sbagliate:
 *   1. la taglia vera e' quella emessa nell'evento `Rebalanced`, e sui due rebalance esistenti
 *      era 0,00005 ETH — meta' della stima, quindi il totale pubblicato era il doppio del vero;
 *   2. l'unico "keeper" in classifica e' un NOSTRO wallet (elencato nella promessa P2), e la
 *      pagina lo presentava come un agente terzo che guadagna dal protocollo.
 * Ora la taglia si legge dall'evento e la provenienza si dichiara.
 */
interface RebalanceEvent {
  executor: string;
  executorIsOurs?: boolean;
  /** Taglia pagata in wei; `null` sul contratto vecchio, che non la emetteva. */
  bounty?: string | null;
  contract?: string;
}

interface KeeperRow {
  executor: string;
  rebalances: number;
  earnedEth: number;
  /** Vero se non conosciamo la taglia di almeno un rebalance (eventi del contratto vecchio). */
  earnedIncomplete: boolean;
  isOurs: boolean;
}

export default function KeepersPage() {
  const [rows, setRows] = useState<KeeperRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRebalances, setTotalRebalances] = useState(0);
  /**
   * La rotta dichiara `partial` quando la fonte della storia completa non risponde e si e'
   * potuto leggere solo una finestra recente. Senza questo, con Blockscout giu' la pagina
   * annunciava "0 rebalance, sii il primo" mentre on-chain ce n'erano 37: la stessa bugia
   * per omissione che stiamo togliendo da tutti i contatori.
   */
  const [parziale, setParziale] = useState(false);
  const [copertura, setCopertura] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Gli EVENTI, non le transazioni: solo l'evento porta la taglia davvero pagata.
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
        setParziale(Boolean(data.partial));
        setCopertura(typeof data.covers === 'string' ? data.covers : null);

        const tally: Record<string, { n: number; wei: bigint; incompleto: boolean; nostro: boolean }> = {};
        for (const ev of events) {
          const executor = ev.executor;
          if (!executor) continue;
          const riga = tally[executor] ?? {
            n: 0,
            wei: 0n,
            incompleto: false,
            nostro: Boolean(ev.executorIsOurs),
          };
          riga.n += 1;
          if (ev.bounty) {
            try {
              riga.wei += BigInt(ev.bounty);
            } catch {
              riga.incompleto = true;
            }
          } else {
            // Nessuna taglia nell'evento: non la inventiamo, la dichiariamo mancante.
            riga.incompleto = true;
          }
          tally[executor] = riga;
        }

        const ranked: KeeperRow[] = Object.entries(tally)
          .map(([executor, v]) => ({
            executor,
            rebalances: v.n,
            earnedEth: Number(ethers.formatEther(v.wei)),
            earnedIncomplete: v.incompleto,
            isOurs: v.nostro,
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
  // Somma delle taglie REALMENTE pagate. `incompleto` segnala che qualche evento non la
  // portava (contratto vecchio): il totale e' un minimo, e va detto invece di arrotondare.
  const totaleEth = rows.reduce((acc, r) => acc + r.earnedEth, 0);
  const incompleto = rows.some((r) => r.earnedIncomplete);

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '48px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>GBLIN Keeper Leaderboard</h1>
      <p style={{ color: '#666', marginBottom: 32, lineHeight: 1.5 }}>
        GBLIN is one of the few protocols on Base that <strong>pays AI agents</strong>. Anyone who rebalances
        the treasury pool earns an <strong>adaptive bounty</strong> — roughly 0.05% of the volume rebalanced,
        capped between 0.00005 and 0.01 ETH, paid only on a successful swap and at most once per hour. The swap
        uses the contract&apos;s own funds, the keeper only pays gas. Below is every address that has run one
        on-chain, with the bounty each was actually paid — read from the <code>Rebalanced</code> event, not
        estimated. Addresses we operate ourselves are marked as such: they are listed in our public{' '}
        <a href="/promises/P2-honest-counters.json">honest-counters promise</a>, so the split between our own
        activity and third-party activity can be reproduced from the chain.
      </p>

      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ padding: '16px 24px', border: '1px solid #e5e5e5', borderRadius: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{totalRebalances}</div>
          <div style={{ color: '#888', fontSize: 13 }}>
            {parziale ? 'rebalances in the window we could read' : 'total rebalances'}
          </div>
        </div>
        <div style={{ padding: '16px 24px', border: '1px solid #e5e5e5', borderRadius: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{rows.filter((r) => !r.isOurs).length}</div>
          <div style={{ color: '#888', fontSize: 13 }}>
            third-party keepers
            {rows.some((r) => r.isOurs) ? ` (+${rows.filter((r) => r.isOurs).length} ours)` : ''}
          </div>
        </div>
        <div style={{ padding: '16px 24px', border: '1px solid #e5e5e5', borderRadius: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {totaleEth.toFixed(5)} ETH{incompleto ? '+' : ''}
          </div>
          <div style={{ color: '#888', fontSize: 13 }}>
            bounties actually paid{incompleto ? ' — the older contract did not emit the amount' : ''}
          </div>
        </div>
      </div>

      {!loading && parziale && rows.length > 0 && (
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
          only {copertura ?? 'a short recent window'}. Older rebalances are missing from this table, not
          from the chain.
        </p>
      )}

      {loading && <p>Loading on-chain keeper activity...</p>}
      {error && <p style={{ color: '#c00' }}>Error: {error}</p>}

      {!loading && !error && rows.length === 0 && parziale && (
        <div style={{ padding: 32, border: '1px dashed #ccc', borderRadius: 12 }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>
            We could not read the full history right now.
          </p>
          <p style={{ color: '#666' }}>
            The block explorer that serves the complete log is not answering, so we fell back to a short
            recent window and found nothing in it. That is not the same as &ldquo;nobody has ever
            rebalanced&rdquo; — the leaderboard will fill back in once the source recovers.
          </p>
        </div>
      )}

      {!loading && !error && rows.length === 0 && !parziale && (
        <div style={{ padding: 32, border: '1px dashed #ccc', borderRadius: 12, textAlign: 'center' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No rebalances recorded yet. Be the first.</p>
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
                  {/* Il contratto precedente non emetteva l'importo: "0 ETH" sarebbe una
                      misura falsa, mentre la verita' e' che quel dato non esiste on-chain. */}
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
        Want to earn? Install the GBLIN MCP server (<code>@gblin-protocol/mcp-server</code>) and call
        {' '}<code>find_keeper_bounty</code>. Data read live from Base mainnet. Rewards depend on pool drift
        and available stability fund.
      </p>
    </main>
  );
}
