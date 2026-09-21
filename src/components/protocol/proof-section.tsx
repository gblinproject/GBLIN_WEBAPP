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

import { useRef, useState } from 'react';
import { ArrowUpRight, ExternalLink, ShieldCheck, TrendingUp, Lock, Coins } from 'lucide-react';
import { DISPLAY_CONTRACT_ADDRESS, formatCurrency, formatPercent, WHITEPAPER_URL } from './protocol-data';
import { NavFeesInline } from './nav-fees';
import { BACKTEST_SERIES, BACKTEST_START } from './backtest-series';

type T = (key: string) => string;

const DUNE_URL = 'https://dune.com/gblin/dashboard';
const DEFILLAMA_URL = 'https://defillama.com/protocol/tvl/global-balanced-liquidity-index';

/** One colour per series, read by both the chart and the figures under it. */
const SERIES_COLOUR = { gblin: '#ffe4a1', btc: '#ff9f33', eth: '#9fb2ff' } as const;

type Row = {
  key: keyof typeof SERIES_COLOUR;
  labelKey: string;
  subKey: string;
  finalValue: number;
  drawdownPct: number;
  winner?: boolean;
};

const ROWS: Row[] = [
  { key: 'gblin', labelKey: 'proof.gblinLabel', subKey: 'proof.gblinSub', finalValue: 1_546_640, drawdownPct: 50.3, winner: true },
  { key: 'btc', labelKey: 'proof.btcLabel', subKey: 'proof.btcSub', finalValue: 1_301_533, drawdownPct: 83.8 },
  { key: 'eth', labelKey: 'proof.ethLabel', subKey: 'proof.ethSub', finalValue: 1_183_376, drawdownPct: 94.0 },
];



/**
 * The ten-year backtest drawn on a logarithmic scale, from the same series the
 * published figures come from. Three bars of text could not show what the shield
 * actually does, which is not end higher but fall less.
 */
function drawdownOf(idx: 1 | 2 | 3) {
  let peak = 0;
  return BACKTEST_SERIES.map((p) => {
    peak = Math.max(peak, p[idx]);
    return ((p[idx] - peak) / peak) * 100;
  });
}

function BacktestChart({ t }: { t: T }) {
  // One view only: the fall. That is what the shield does, and the closing
  // value of all three strategies is spelled out in the figures below.
  const falls = [drawdownOf(1), drawdownOf(2), drawdownOf(3)];
  const w = 720;
  const h = 330;
  const padL = 52;
  // Room on the right for the name of each line, the way a terminal labels them.
  const padR = 62;
  const padT = 18;
  const padB = 30;
  const n = BACKTEST_SERIES.length - 1;
  const x = (i: number) => padL + (i / n) * (w - padL - padR);
  // Drawdown runs 0 to -100 on a plain scale: no log, because the distance from the
  // peak is the quantity being compared.
  const yFall = (v: number) => padT + (-v / 100) * (h - padT - padB);
  const path = (idx: 1 | 2 | 3) =>
    falls[idx - 1].map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yFall(v).toFixed(1)}`).join(' ');
  const fallTicks = [0, -25, -50, -75, -100];
  const years = ['2016', '2018', '2020', '2022', '2024', '2026'];
  const yearIndex = (yr: string) => BACKTEST_SERIES.findIndex((p) => p[0].startsWith(yr));
  const lines: Array<{ d: string; color: string; width: number; label: string; short: string; endY: number }> = [
    { d: path(1), color: SERIES_COLOUR.gblin, width: 2.6, label: t('proof.gblinLabel'), short: 'GBLIN', endY: yFall(falls[0][n]) },
    { d: path(2), color: SERIES_COLOUR.btc, width: 1.6, label: t('proof.btcLabel'), short: 'BTC', endY: yFall(falls[1][n]) },
    { d: path(3), color: SERIES_COLOUR.eth, width: 1.6, label: t('proof.ethLabel'), short: 'ETH', endY: yFall(falls[2][n]) },
  ];

  // Crosshair: without it the chart is a poster. Pointer only, no library.
  const box = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const el = box.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.round(((px - padL) / (w - padL - padR)) * n);
    setHover(i >= 0 && i <= n ? i : null);
  };
  const point = hover !== null ? BACKTEST_SERIES[hover] : null;

  return (
    <div>
      <p className="g-eyebrow mb-4 text-right">{t('proof.viewFall')}</p>
      <svg
        className="w-full touch-none"
        onPointerLeave={() => setHover(null)}
        onPointerMove={onMove}
        ref={box}
        role="img"
        viewBox={`0 0 ${w} ${h}`}
      >
        <rect
          fill="none"
          height={h - padT - padB}
          stroke="rgba(244,240,231,0.07)"
          width={w - padL - padR}
          x={padL}
          y={padT}
        />
        {fallTicks.map((v) => {
          const yy = yFall(v);
          return (
            <g key={v}>
              <line stroke="rgba(255,255,255,0.07)" x1={padL} x2={w - padR} y1={yy} y2={yy} />
              <text fill="#8f887b" fontFamily="var(--font-mono)" fontSize="10" x={4} y={yy + 3}>
                {`${v}%`}
              </text>
            </g>
          );
        })}
        {years.map((yr) => {
          const i = yearIndex(yr);
          if (i < 0) return null;
          return (
            <text fill="#6f695e" fontFamily="var(--font-mono)" fontSize="10" key={yr} textAnchor="middle" x={x(i)} y={h - 8}>
              {yr}
            </text>
          );
        })}
        {/* Drawn back to front: ours is the subject, so it is painted last and
            nothing crosses over it. */}
        {[...lines].reverse().map((l) => (
          <path d={l.d} fill="none" key={l.label} stroke={l.color} strokeLinejoin="round" strokeWidth={l.width} />
        ))}
        {/* The name sits at the end of its own line, so no legend is needed. */}
        {lines.map((l) => (
          <g key={`end-${l.short}`}>
            <circle cx={w - padR + 6} cy={l.endY} fill={l.color} r="3" />
            <text fill={l.color} fontFamily="var(--font-mono)" fontSize="10" x={w - padR + 14} y={l.endY + 3.5}>
              {l.short}
            </text>
          </g>
        ))}
        {point ? (
          <g>
            <line stroke="rgba(244,239,228,0.25)" x1={x(hover as number)} x2={x(hover as number)} y1={padT} y2={h - padB} />
            {([1, 2, 3] as const).map((idx) => (
              <circle
                cx={x(hover as number)}
                cy={yFall(falls[idx - 1][hover as number])}
                fill={lines[idx - 1].color}
                key={idx}
                r={3}
              />
            ))}
          </g>
        ) : null}
      </svg>
      <div className="mt-3 min-h-[68px]">
        {point ? (
          <div className="inline-block rounded-sm border border-[color:var(--line-strong)] bg-[#0b0b0a] px-4 py-3">
            <p className="tnum font-mono text-[11px] text-zinc-500">{point[0]}</p>
            <div className="mt-2 space-y-1.5">
              {lines.map((l, i) => (
                <div className="flex items-center gap-3 text-[11px]" key={l.label}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: l.color }} />
                  <span className="min-w-[38px] text-zinc-400">{l.short}</span>
                  <span className="tnum font-mono text-zinc-100">
                    {`\u2212${formatPercent(Math.abs(falls[i][hover as number]), 1)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-600">{t('proof.hoverHint')}</p>
        )}
      </div>
    </div>
  );
}

export function ProofSection({ t }: { t: T }) {
  return (
    <section className="g-section">
      <div className="g-card overflow-hidden">
        <div className="p-6 sm:p-8 lg:p-10">
          {/* The label rule sits inside the panel, as on the reference. */}
          <div className="flex items-center gap-6">
            <span className="g-eyebrow g-eyebrow-gold shrink-0">{t('ui.home.perfEyebrow')}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--line-strong)]" />
            <span className="g-eyebrow hidden shrink-0 sm:block">{t('proof.daysBadge')}</span>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-14">
            {/* The claim, in three lines, then the way to check it. */}
            <div className="min-w-0 lg:self-center">
              <h2 className="font-display text-[clamp(1.9rem,3.4vw,2.6rem)] font-light uppercase leading-[1.1] tracking-[0.03em] text-[color:var(--ink)]">
                {t('proof.headA')}
                <br />
                {t('proof.headHi')}
              </h2>
              <p className="mt-6 max-w-[30rem] text-[15px] leading-7 text-zinc-400">{t('proof.intro')}</p>
              {/* What the shield is for, stated before the figures. */}
              <p className="mt-4 max-w-[30rem] text-sm leading-7 text-zinc-500">{t('proof.ethNote')}</p>
              <a className="g-pill mt-8" href={WHITEPAPER_URL} rel="noopener noreferrer" target="_blank">
                {t('proof.whitepaper')}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* The series that produced those figures. */}
            <div className="min-w-0">
              <BacktestChart t={t} />

              {/* The three outcomes, on one line under the chart. */}
              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[color:var(--line)] pt-5">
                {ROWS.map((row) => (
                  <div key={row.key}>
                    <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: SERIES_COLOUR[row.key] }}>
                      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SERIES_COLOUR[row.key] }} />
                      {t(row.labelKey)}
                    </p>
                    <p className="tnum mt-2 font-mono text-lg font-light leading-none" style={{ color: SERIES_COLOUR[row.key] }}>
                      {formatCurrency(row.finalValue, 0)}
                    </p>
                    <p className="tnum mt-1.5 text-[11px] text-zinc-500">
                      {t('proof.maxDd')} −{formatPercent(Math.abs(row.drawdownPct), 1)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[color:var(--line)] px-6 py-6 sm:px-8 lg:px-10">
          <p className="g-eyebrow">{t('proof.methodTitle')}</p>
          <p className="mt-3 max-w-4xl text-xs leading-6 text-zinc-600">
            {t('proof.methodBody')}
            <span className="mt-2 block">{t('proof.disclaimer')}</span>
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a className="g-chip" href={DEFILLAMA_URL} rel="noopener noreferrer" target="_blank">
              DefiLlama
              <ExternalLink className="h-3 w-3" />
            </a>
            <a className="g-chip" href={DUNE_URL} rel="noopener noreferrer" target="_blank">
              Dune
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeeEngineSection({ t }: { t: T }) {
  // The three figures the reader is actually buying: what a purchase costs, what
  // the builder keeps, what goes back into the reserves.
  const flow = [
    { value: '0.10%', label: t('feeEngine.flowBuy'), gold: false },
    { value: '0.05%', label: t('feeEngine.flowDev'), gold: false },
    { value: '0.05%', label: t('feeEngine.flowTreasury'), gold: true },
  ];

  return (
    <section className="g-section">
      <div className="flex items-center gap-6">
        <span className="g-eyebrow shrink-0 text-[color:var(--ink)]">{t('feeEngine.badge')}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--line-strong)]" />
      </div>

      <h2 className="font-display mt-7 max-w-[24ch] text-[clamp(1.6rem,3vw,2.25rem)] font-light leading-[1.15] text-[color:var(--ink)]">
        {t('feeEngine.headA')} <span className="text-amber-300">{t('feeEngine.headHi')}</span>
      </h2>
      <p className="mt-5 max-w-[42rem] text-[15px] leading-7 text-zinc-500">{t('feeEngine.intro')}</p>

      {/* Three numbers, large, separated by rules instead of boxes. */}
      <div className="mt-12 grid gap-10 border-y border-[color:var(--line)] py-10 md:grid-cols-3 md:gap-0">
        {flow.map((item, i) => (
          <div className={`md:px-10 ${i > 0 ? 'md:border-l md:border-[color:var(--line)]' : 'md:pl-0'} ${i === 2 ? 'md:pr-0' : ''}`} key={item.label}>
            <p className={`tnum font-mono text-[clamp(2.2rem,4.6vw,3.25rem)] font-light leading-none ${item.gold ? 'text-amber-200' : 'text-[color:var(--ink)]'}`}>
              {item.value}
            </p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-zinc-500">{item.label}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 max-w-[46rem] text-[15px] leading-7 text-zinc-400">{t('feeEngine.punchline')}</p>

      <div className="mt-8 grid gap-8 sm:grid-cols-3">
        {[
          { v: '0%', k: t('feeEngine.b1k') },
          { v: t('feeEngine.b2v'), k: t('feeEngine.b2k') },
          { v: 'NAV ↑', k: t('feeEngine.b3k') },
        ].map((c) => (
          <div key={c.k}>
            <p className="tnum font-mono text-xl font-light leading-none text-amber-200">{c.v}</p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-zinc-500">{c.k}</p>
          </div>
        ))}
      </div>

      <a
        className="g-pill mt-9"
        href={`https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        {t('feeEngine.verify')}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      {/* What you don't pay — the number that scales with the reader, not with our size. */}
      <div className="mt-14 border-t border-[color:var(--line)] pt-10">
        <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink)]">{t('feeEngine.costTitle')}</p>
        <p className="mt-4 max-w-[42rem] text-sm leading-7 text-zinc-500">{t('feeEngine.costIntro')}</p>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[420px] max-w-3xl text-left text-sm">
            <thead className="g-eyebrow">
              <tr className="border-b border-[color:var(--line)]">
                <th className="pb-3 pr-4 font-medium">{t('feeEngine.costCol0')}</th>
                <th className="pb-3 pr-4 font-medium text-amber-300">{t('feeEngine.costCol1')}</th>
                <th className="pb-3 font-medium">{t('feeEngine.costCol2')}</th>
              </tr>
            </thead>
            <tbody className="tnum font-mono text-zinc-300">
              <tr className="border-b border-[color:var(--line)]">
                <td className="py-4 pr-4 font-sans text-zinc-500">{t('feeEngine.costRow1')}</td>
                <td className="py-4 pr-4 text-lg font-light text-amber-200">$6</td>
                <td className="py-4 text-lg font-light text-zinc-400">$20</td>
              </tr>
              <tr>
                <td className="py-4 pr-4 font-sans text-zinc-500">{t('feeEngine.costRow2')}</td>
                <td className="py-4 pr-4 text-lg font-light text-amber-200">$26</td>
                <td className="py-4 text-lg font-light text-zinc-400">$100</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-5 max-w-[42rem] text-[11px] leading-5 text-zinc-600">{t('feeEngine.costNote')}</p>
      </div>

      {/* The running total, where the mechanism above gives it context. */}
      <NavFeesInline t={t} />
    </section>
  );
}
