'use client';

/**
 * ProofSection + FeeEngineSection — the protocol's flagship "killer proof" blocks.
 *
 * Data source: 10-year backtest of GBLIN V6's exact on-chain Crash Shield logic
 * (refreshWeights) replayed over 3,688 real daily BTC & ETH closes from Coinbase
 * (18 May 2016 → 24 Jun 2026), $10,000 start. The live config is setShieldCurve(15,3000).
 * Verified four ways: buy&hold reproduces price ratios exactly, shield-off reproduces a
 * static 45/45/10 basket exactly, weights always sum to 1, results are deterministic.
 *
 * Colors kept on-brand: deep black, amber accent, white/opacity, serif headings.
 */

import { useEffect, useState } from 'react';
import { ArrowUpRight, ExternalLink, ShieldCheck, TrendingUp, Lock, Coins } from 'lucide-react';
import { DISPLAY_CONTRACT_ADDRESS, WHITEPAPER_URL } from './protocol-data';

const DUNE_URL = 'https://dune.com/gblin/dashboard';
const DEFILLAMA_URL = 'https://defillama.com/protocol/tvl/global-balanced-liquidity-index';

type Row = {
  key: string;
  label: string;
  sub: string;
  finalValue: number;
  finalLabel: string;
  drawdown: string;
  winner?: boolean;
};

const ROWS: Row[] = [
  {
    key: 'gblin',
    label: 'GBLIN Crash Shield',
    sub: 'Live config on Base',
    finalValue: 1_546_640,
    finalLabel: '$1,546,640',
    drawdown: '−50.3%',
    winner: true,
  },
  {
    key: 'btc',
    label: 'Hold 100% BTC',
    sub: 'Buy & hold Bitcoin',
    finalValue: 1_301_533,
    finalLabel: '$1,301,533',
    drawdown: '−83.8%',
  },
  {
    key: 'eth',
    label: 'Hold 100% ETH',
    sub: 'Buy & hold Ethereum',
    finalValue: 1_183_376,
    finalLabel: '$1,183,376',
    drawdown: '−94.0%',
  },
];

const MAX = ROWS[0].finalValue;

export function ProofSection() {
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
        {/* Eyebrow + headline */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            10-Year Backtest · Real Data
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-zinc-400">
            3,688 days · Coinbase · 2016 → 2026
          </span>
        </div>

        <h2 className="font-serif text-[clamp(2rem,5vw,3.4rem)] leading-[0.95] tracking-tight text-white max-w-3xl">
          GBLIN beat{' '}
          <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text italic text-transparent">
            holding BTC and ETH
          </span>{' '}
          — over ten real years.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
          We didn&apos;t draw a marketing chart. We replayed GBLIN&apos;s exact on-chain Crash Shield over a decade of
          real Coinbase prices — every bull, both bears, COVID and FTX. Starting from $10,000:
        </p>

        {/* Comparison bars */}
        <div className="mt-9 space-y-5">
          {ROWS.map((row) => {
            const pct = Math.max(6, Math.round((row.finalValue / MAX) * 100));
            return (
              <div key={row.key}>
                <div className="flex items-end justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-bold tracking-tight ${row.winner ? 'text-amber-300' : 'text-white/85'}`}>
                      {row.label}
                      {row.winner && (
                        <span className="ml-2 align-middle rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                          Winner
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-500">{row.sub}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-serif text-xl sm:text-2xl leading-none tracking-tight ${row.winner ? 'text-amber-400' : 'text-white'}`}>
                      {row.finalLabel}
                    </p>
                    <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                      Max drawdown <span className={row.winner ? 'text-emerald-400' : 'text-rose-400/80'}>{row.drawdown}</span>
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

        {/* Highlights */}
        <div className="mt-9 grid gap-3 sm:grid-cols-3">
          {[
            { v: '+$245,107', k: 'vs. holding BTC', i: <TrendingUp className="h-4 w-4" /> },
            { v: '+$363,264', k: 'vs. holding ETH', i: <TrendingUp className="h-4 w-4" /> },
            { v: '≈ ½', k: 'the max drawdown', i: <ShieldCheck className="h-4 w-4" /> },
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

        {/* Method + verify */}
        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-400/70 mb-2">How we proved it</p>
          <p className="text-xs leading-6 text-white/55">
            We ported the live <span className="text-white/80 font-semibold">refreshWeights()</span> logic line by line —
            EWMA volatility, dual decaying price peaks, an adaptive drawdown threshold, proportional de-risking into USDC,
            and hysteresis on recovery — then applied <span className="text-white/80 font-semibold">yesterday&apos;s</span> weights
            to each day&apos;s real return (zero look-ahead). Validated four ways: buy &amp; hold reproduces price ratios to the
            cent, shield-off reproduces a static 45/45/10 basket exactly, weights always sum to 1, results are deterministic.
            <span className="block mt-2 text-zinc-600">Backtest of the live shield logic on real historical prices. Past performance is not indicative of future results.</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <a href={DEFILLAMA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300 transition hover:bg-emerald-500/[0.12]">
              <ExternalLink className="h-3.5 w-3.5" /> DefiLlama
            </a>
            <a href={DUNE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300 transition hover:border-amber-500/25 hover:text-amber-300">
              <ExternalLink className="h-3.5 w-3.5" /> Dune analytics
            </a>
            <a href={WHITEPAPER_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300 transition hover:bg-amber-500/[0.12]">
              <ArrowUpRight className="h-3.5 w-3.5" /> Whitepaper
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeeEngineSection() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#080808]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
      <div className="absolute -right-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-amber-500/[0.06] blur-[80px]" />

      <div className="relative p-7 sm:p-10 lg:p-12">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-amber-300">
            <TrendingUp className="h-3.5 w-3.5" />
            The Appreciation Engine
          </span>
        </div>

        <h2 className="font-serif text-[clamp(1.8rem,4.5vw,3rem)] leading-[0.98] tracking-tight text-white max-w-3xl">
          Every purchase makes{' '}
          <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text italic text-transparent">
            every token worth more.
          </span>
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
          A flat <span className="text-white/85 font-semibold">0.10%</span> fee applies only when you <span className="text-white/85 font-semibold">buy</span> GBLIN.
          Sending and holding GBLIN is always free — perfect for everyday payments. Here is exactly where that 0.10% goes:
        </p>

        {/* Flow */}
        <div className="mt-9 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {/* Buy */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-center flex flex-col items-center justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] text-white mb-3">
              <Coins className="h-5 w-5" />
            </div>
            <p className="font-serif text-2xl text-white leading-none">0.10%</p>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">Fee on every buy</p>
          </div>

          <div className="hidden lg:flex items-center justify-center text-amber-500/50">
            <ArrowUpRight className="h-6 w-6 rotate-45" />
          </div>

          {/* Dev */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center flex flex-col items-center justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300 mb-3">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="font-serif text-2xl text-white leading-none">0.05%</p>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">Funds development</p>
          </div>

          <div className="hidden lg:flex items-center justify-center text-amber-500/50">
            <ArrowUpRight className="h-6 w-6 rotate-45" />
          </div>

          {/* Treasury */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center flex flex-col items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.12)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-300 mb-3">
              <Lock className="h-5 w-5" />
            </div>
            <p className="font-serif text-2xl text-amber-400 leading-none">0.05%</p>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-amber-300/80">Into the treasury</p>
          </div>
        </div>

        {/* The punchline */}
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-transparent p-6">
          <p className="text-sm leading-7 text-white/70">
            That treasury slice buys real <span className="text-white/90 font-semibold">cbBTC, WETH and USDC</span> straight into the vault —
            <span className="text-amber-300 font-semibold"> without minting a single new GBLIN</span>. Same supply, more assets behind it.
            So the intrinsic value (NAV) of <span className="text-white/90 font-semibold">every</span> GBLIN already in circulation rises — mathematically, on every single buy.
            No staking, no lock-ups, no emissions. Just a treasury that only grows.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { v: '0%', k: 'Fee to transfer or hold' },
              { v: 'Zero', k: 'Pre-mint — fully collateralized' },
              { v: 'NAV ↑', k: 'For every holder, every buy' },
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
            <ExternalLink className="h-3.5 w-3.5" /> Verify the contract on BaseScan
          </a>
        </div>
      </div>
    </section>
  );
}
