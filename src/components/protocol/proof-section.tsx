'use client';

/**
 * ProofSection + FeeEngineSection — the protocol's flagship "killer proof" blocks.
 *
 * Data source: 10-year backtest of GBLIN V6's exact on-chain Crash Shield logic
 * (refreshWeights) replayed over 3,688 real daily BTC & ETH closes from Coinbase
 * (18 May 2016 → 24 Jun 2026), $10,000 start. Live config: setShieldCurve(15,3000).
 * Verified four ways: buy&hold reproduces price ratios exactly, shield-off reproduces a
 * static 45/45/10 basket exactly, weights always sum to 1, results are deterministic.
 *
 * Copy is fully localized through the protocol i18n `t()` (proof.* / feeEngine.*).
 * Numbers and symbols are language-neutral and kept inline.
 */

import { useEffect, useState } from 'react';
import { ArrowUpRight, ExternalLink, ShieldCheck, TrendingUp, Lock, Coins } from 'lucide-react';
import { DISPLAY_CONTRACT_ADDRESS, WHITEPAPER_URL } from './protocol-data';
import { NavFeesInline } from './nav-fees';

type T = (key: string) => string;

const DUNE_URL = 'https://dune.com/gblin/dashboard';
const DEFILLAMA_URL = 'https://defillama.com/protocol/tvl/global-balanced-liquidity-index';

type Row = {
  key: string;
  labelKey: string;
  subKey: string;
  finalValue: number;
  finalLabel: string;
  drawdown: string;
  winner?: boolean;
};

const ROWS: Row[] = [
  { key: 'gblin', labelKey: 'proof.gblinLabel', subKey: 'proof.gblinSub', finalValue: 1_546_640, finalLabel: '$1,546,640', drawdown: '−50.3%', winner: true },
  { key: 'btc', labelKey: 'proof.btcLabel', subKey: 'proof.btcSub', finalValue: 1_301_533, finalLabel: '$1,301,533', drawdown: '−83.8%' },
  { key: 'eth', labelKey: 'proof.ethLabel', subKey: 'proof.ethSub', finalValue: 1_183_376, finalLabel: '$1,183,376', drawdown: '−94.0%' },
];

const MAX = ROWS[0].finalValue;

export function ProofSection({ t }: { t: T }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 120);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-amber-500/25 bg-[#080808]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-[90px]" />
      <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-amber-500/[0.06] blur-[80px]" />

      <div className="relative p-7 sm:p-10 lg:p-12">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('proof.backtestBadge')}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-zinc-400">
            {t('proof.daysBadge')}
          </span>
        </div>

        <h2 className="font-serif text-[clamp(2rem,5vw,3.4rem)] leading-[0.95] tracking-tight text-white max-w-3xl">
          {t('proof.headA')}{' '}
          <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text italic text-transparent">
            {t('proof.headHi')}
          </span>{' '}
          {t('proof.headB')}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">{t('proof.intro')}</p>

        <div className="mt-9 space-y-5">
          {ROWS.map((row) => {
            const pct = Math.max(6, Math.round((row.finalValue / MAX) * 100));
            return (
              <div key={row.key}>
                <div className="flex items-end justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-bold tracking-tight ${row.winner ? 'text-amber-300' : 'text-white/85'}`}>
                      {t(row.labelKey)}
                      {row.winner && (
                        <span className="ml-2 align-middle rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                          {t('proof.winner')}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-500">{t(row.subKey)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-serif text-xl sm:text-2xl leading-none tracking-tight ${row.winner ? 'text-amber-400' : 'text-white'}`}>
                      {row.finalLabel}
                    </p>
                    <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                      {t('proof.maxDd')} <span className={row.winner ? 'text-emerald-400' : 'text-rose-400/80'}>{row.drawdown}</span>
                    </p>
                  </div>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.03]">
                  <div
                    className={`h-full rounded-full transition-[width] duration-1000 ease-out ${
                      row.winner
                        ? 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.45)]'
                        : 'bg-gradient-to-r from-zinc-600 to-zinc-500'
                    }`}
                    style={{ width: mounted ? `${pct}%` : '0%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-9 grid gap-3 sm:grid-cols-3">
          {[
            { v: '+$245,107', k: t('proof.vsBtc'), i: <TrendingUp className="h-4 w-4" /> },
            { v: '+$363,264', k: t('proof.vsEth'), i: <TrendingUp className="h-4 w-4" /> },
            { v: '≈ ½', k: t('proof.halfDd'), i: <ShieldCheck className="h-4 w-4" /> },
          ].map((h) => (
            <div key={h.k} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300 mb-3">
                {h.i}
              </div>
              <p className="font-serif text-2xl tracking-tight text-amber-400 leading-none">{h.v}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">{h.k}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-400/70 mb-2">{t('proof.methodTitle')}</p>
          <p className="text-xs leading-6 text-white/55">
            {t('proof.methodBody')}
            <span className="block mt-2 text-zinc-600">{t('proof.disclaimer')}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <a href={DEFILLAMA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300 transition hover:bg-emerald-500/[0.12]">
              <ExternalLink className="h-3.5 w-3.5" /> DefiLlama
            </a>
            <a href={DUNE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300 transition hover:border-amber-500/25 hover:text-amber-300">
              <ExternalLink className="h-3.5 w-3.5" /> Dune
            </a>
            <a href={WHITEPAPER_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300 transition hover:bg-amber-500/[0.12]">
              <ArrowUpRight className="h-3.5 w-3.5" /> {t('proof.whitepaper')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeeEngineSection({ t }: { t: T }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#080808]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
      <div className="absolute -right-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-amber-500/[0.06] blur-[80px]" />

      <div className="relative p-7 sm:p-10 lg:p-12">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-amber-300">
            <TrendingUp className="h-3.5 w-3.5" />
            {t('feeEngine.badge')}
          </span>
        </div>

        <h2 className="font-serif text-[clamp(1.8rem,4.5vw,3rem)] leading-[0.98] tracking-tight text-white max-w-3xl">
          {t('feeEngine.headA')}{' '}
          <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text italic text-transparent">
            {t('feeEngine.headHi')}
          </span>
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">{t('feeEngine.intro')}</p>

        <div className="mt-9 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-center flex flex-col items-center justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] text-white mb-3">
              <Coins className="h-5 w-5" />
            </div>
            <p className="font-serif text-2xl text-white leading-none">0.10%</p>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">{t('feeEngine.flowBuy')}</p>
          </div>

          <div className="hidden lg:flex items-center justify-center text-amber-500/50">
            <ArrowUpRight className="h-6 w-6 rotate-45" />
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center flex flex-col items-center justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300 mb-3">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="font-serif text-2xl text-white leading-none">0.05%</p>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">{t('feeEngine.flowDev')}</p>
          </div>

          <div className="hidden lg:flex items-center justify-center text-amber-500/50">
            <ArrowUpRight className="h-6 w-6 rotate-45" />
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center flex flex-col items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.12)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-300 mb-3">
              <Lock className="h-5 w-5" />
            </div>
            <p className="font-serif text-2xl text-amber-400 leading-none">0.05%</p>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-amber-300/80">{t('feeEngine.flowTreasury')}</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-transparent p-6">
          <p className="text-sm leading-7 text-white/70">{t('feeEngine.punchline')}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { v: '0%', k: t('feeEngine.b1k') },
              { v: t('feeEngine.b2v'), k: t('feeEngine.b2k') },
              { v: 'NAV ↑', k: t('feeEngine.b3k') },
            ].map((c) => (
              <div key={c.k} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="font-serif text-xl text-amber-400 leading-none">{c.v}</p>
                <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">{c.k}</p>
              </div>
            ))}
          </div>
          <a
            href={`https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300 transition hover:border-amber-500/25 hover:text-amber-300"
          >
            <ExternalLink className="h-3.5 w-3.5" /> {t('feeEngine.verify')}
          </a>
        </div>

        {/* What you don't pay — the number that scales with the reader, not with our size. */}
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
          <p className="text-sm font-semibold text-white">{t('feeEngine.costTitle')}</p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/50">{t('feeEngine.costIntro')}</p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                <tr className="border-b border-white/[0.07]">
                  <th className="pb-3 pr-4 font-normal">{t('feeEngine.costCol0')}</th>
                  <th className="pb-3 pr-4 font-normal text-amber-400/80">{t('feeEngine.costCol1')}</th>
                  <th className="pb-3 font-normal">{t('feeEngine.costCol2')}</th>
                </tr>
              </thead>
              <tbody className="font-mono text-zinc-300">
                <tr className="border-b border-white/[0.04]">
                  <td className="py-3 pr-4 font-sans text-zinc-400">{t('feeEngine.costRow1')}</td>
                  <td className="py-3 pr-4 text-amber-300">$1</td>
                  <td className="py-3 text-zinc-400">$20</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-sans text-zinc-400">{t('feeEngine.costRow2')}</td>
                  <td className="py-3 pr-4 text-amber-300">$1</td>
                  <td className="py-3 text-zinc-400">$100</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 max-w-2xl text-[11px] leading-5 text-zinc-500">{t('feeEngine.costNote')}</p>
        </div>

        {/* The running total, where the mechanism above gives it context. */}
        <NavFeesInline t={t} />
      </div>
    </section>
  );
}
