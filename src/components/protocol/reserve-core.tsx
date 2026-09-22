/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { AssetMark } from './asset-mark';
import type { BasketItem } from './protocol-data';
import { formatCurrency, formatPercent } from './protocol-data';

/**
 * The reserve core: the visual signature of the site.
 *
 * The lit ring is computed, not drawn in CSS and not upscaled from a capture:
 * a gold torus is shaded with an environment reflection and a bloom, so it
 * stays sharp at any size. Everything that carries meaning is
 * ours and live. The arcs outside the ring are the weights read from the vault,
 * the ticks are the targets the auction works towards, and the centre is our
 * own mark over a disc that covers the render's own lettering.
 */

// The three coins sit on ONE circle, concentric with the ring. They used to be
// placed by hand as percentages of the frame and fell neither on the same
// radius nor around the same centre; here only the angle is declared.
const CENTRE_X = 50;
const CENTRE_Y = 47;      // centre of the ring, as a percentage of the frame
// The radius is not a fixed number: on a narrow screen the ring fills more of
// the frame, and at 35 the coin crossed into the gold band. It lives in
// --node-radius (globals.css) so the gap between coin and band always holds.
const NODE_RADIUS = 'var(--node-radius)';

const NODE = {
  cbBTC: { degrees: -90, side: 'right', labelBeside: true },
  WETH: { degrees: 168, side: 'left', labelBeside: false },
  USDC: { degrees: 12, side: 'right', labelBeside: false },
} as const;

// Rounded to four decimals: the server and the browser disagree on the last
// digit of a cosine, and React then reports a hydration mismatch.
const roundOff = (v: number) => Math.round(v * 10000) / 10000;
const placeAt = (degrees: number) => {
  const a = (degrees * Math.PI) / 180;
  return {
    x: `calc(${CENTRE_X}% + ${roundOff(Math.cos(a))} * ${NODE_RADIUS})`,
    y: `calc(${CENTRE_Y}% + ${roundOff(Math.sin(a))} * ${NODE_RADIUS})`,
  };
};

type NodeName = keyof typeof NODE;

function AssetNode({ asset, t }: { asset: BasketItem; t: (key: string) => string }) {
  const spec = NODE[asset.name as NodeName];
  if (!spec) return null;
  const { x, y } = placeAt(spec.degrees);

  // The label is out of flow: inside the box it would move the box's centre and
  // the coin would no longer fall on the computed circle. The top coin keeps its
  // label BESIDE it at every size: below would land on the ring, above would
  // leave the frame.
  const beside = 'absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap text-left';
  const below = 'absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap text-center';
  const labelClass = spec.labelBeside
    ? beside
    : spec.side === 'right'
      ? `${below} md:left-full md:top-1/2 md:ml-3 md:mt-0 md:-translate-x-0 md:-translate-y-1/2 md:text-left`
      : `${below} md:left-auto md:right-full md:top-1/2 md:mr-3 md:mt-0 md:translate-x-0 md:-translate-y-1/2 md:text-right`;

  return (
    <span
      className="absolute z-20 block"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      <span className="relative block rounded-full" style={{ boxShadow: '0 0 34px rgba(255, 199, 46,0.3), 0 8px 24px rgba(0,0,0,0.6)' }}>
        <AssetMark className="block h-[clamp(2.6rem,5.2vw,3.75rem)] w-[clamp(2.6rem,5.2vw,3.75rem)]" name={asset.name} />
        <span className={labelClass}>
          <span className="block text-[13px] font-medium leading-tight tracking-[0.04em] text-[color:var(--ink)]">{asset.name}</span>
          <span className="tnum mt-1.5 block font-mono text-[13px] leading-none text-zinc-400">
            {asset.realWeight > 0 ? formatPercent(asset.realWeight, 1) : t('ui.core.reading')}
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * What the stability fee has left in the reserves since launch. Not an
 * estimate: the figure comes from the vault's Minted events, summed at the rate
 * read from the contract, and grows on its own with every purchase.
 */
function useReturnedToReserves() {
  const [usd, setUsd] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/nav-fees')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((d: { usd?: number }) => {
        if (!cancelled && typeof d?.usd === 'number') setUsd(d.usd);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return usd;
}

export function ReserveCore({
  basket,
  t,
  loading,
}: {
  basket: BasketItem[];
  t: (key: string) => string;
  loading?: boolean;
}) {
  const returnedToReserves = useReturnedToReserves();
  const cx = 500;
  const cy = 470;
  // Just outside the rendered band, so the live arcs read as belonging to it.
  const arcR = 258;
  const total = basket.reduce((sum, a) => sum + Math.max(a.realWeight, 0), 0) || 100;
  const circumference = 2 * Math.PI * arcR;
  const tone: Record<string, string> = { cbBTC: '#ffe58f', WETH: '#9a8f78', USDC: '#6f7f8c' };
  let offset = 0;

  // Rounded to two decimals: the server and the browser disagree on the last
  // digit of a trigonometric result, and React then reports a hydration mismatch.
  const p = (v: number) => Math.round(v * 100) / 100;

  return (
    <div className="g-core relative mx-auto -mb-[8%] w-full max-w-[700px] sm:mb-0" role="img" aria-label={t('ui.core.alt')}>
      <div className="relative aspect-square w-full">
        {/* Behind everything: the halo and the two orbits, which have to turn. */}
        <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000">
          <defs>
            <radialGradient id="rc-halo" cx="50%" cy="47%" r="50%">
              <stop offset="0%" stopColor="#ffc72e" stopOpacity=".2" />
              <stop offset="42%" stopColor="#ffc72e" stopOpacity=".06" />
              <stop offset="100%" stopColor="#050505" stopOpacity="0" />
            </radialGradient>
            <filter id="rc-spark" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>

          <circle cx={cx} cy={cy} r="500" fill="url(#rc-halo)" />

          <g className="g-orbit" style={{ transformOrigin: `${cx}px ${cy}px` }}>
            <g transform={`rotate(-20 ${cx} ${cy})`}>
              <ellipse cx={cx} cy={cy} rx="478" ry="392" fill="none" stroke="#ffc72e" strokeOpacity=".28" />
              <circle cx={cx + 478} cy={cy} r="7" fill="#ffeec2" filter="url(#rc-spark)" />
              <circle cx={cx + 478} cy={cy} r="3" fill="#fff6dd" />
            </g>
          </g>
          <g className="g-orbit-slow" style={{ transformOrigin: `${cx}px ${cy}px` }}>
            <g transform={`rotate(24 ${cx} ${cy})`}>
              <ellipse cx={cx} cy={cy} rx="478" ry="392" fill="none" stroke="#ffc72e" strokeOpacity=".15" />
              <circle cx={cx - 478} cy={cy} r="5" fill="#ffeec2" filter="url(#rc-spark)" />
            </g>
          </g>

          <circle cx={cx} cy={cy} r="412" fill="none" stroke="#ffc72e" strokeOpacity=".13" />
          <circle cx={cx} cy={cy} r="438" fill="none" stroke="#ffc72e" strokeOpacity=".08" strokeDasharray="2 14" />
        </svg>

        {/* The lit ring itself, masked so it dissolves instead of ending on a square. */}
        <img
          alt=""
          // The file carries its own transparency, so it needs no blend mode: a
          // blend group does not always include what the hero paints behind it,
          // and the black of the file then covers that light instead of adding.
          className="pointer-events-none absolute left-1/2 top-[47%] w-[62%] -translate-x-1/2 -translate-y-1/2 select-none md:w-[72%]"
          height={1600}
          src="/images/gblin/core-ring.png"
          width={1600}
        />

        {/* On top of the ring: the allocation read from the vault. */}
        <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000">
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {basket.map((asset) => {
              const share = Math.max(asset.realWeight, 0) / total;
              const len = share * circumference - 8;
              const arc =
                len > 1 ? (
                  <circle
                    cx={cx}
                    cy={cy}
                    fill="none"
                    key={asset.address}
                    r={arcR}
                    stroke={tone[asset.name] ?? '#5e5a52'}
                    strokeDasharray={`${len.toFixed(2)} ${(circumference - len).toFixed(2)}`}
                    strokeDashoffset={-offset.toFixed(2)}
                    strokeOpacity=".55"
                    strokeWidth="2"
                  />
                ) : null;
              offset += share * circumference;
              return arc;
            })}
            {basket.reduce<{ acc: number; marks: ReactElement[] }>(
              (state, asset) => {
                const ang = (state.acc / 100) * 2 * Math.PI;
                const r1 = arcR - 8;
                const r2 = arcR + 8;
                state.marks.push(
                  <line
                    key={`t-${asset.address}`}
                    stroke="rgba(244,240,231,0.3)"
                    strokeWidth="1"
                    x1={p(cx + r1 * Math.cos(ang))}
                    x2={p(cx + r2 * Math.cos(ang))}
                    y1={p(cy + r1 * Math.sin(ang))}
                    y2={p(cy + r2 * Math.sin(ang))}
                  />
                );
                state.acc += asset.baseWeight / 100;
                return state;
              },
              { acc: 0, marks: [] }
            ).marks}
          </g>
        </svg>

        {/* At the centre: what every mint has left in the reserves, which belong
            to whoever holds the token. A small figure is written with more
            decimals, because rounded to two it would read as zero and say
            something untrue. */}
        <div className="absolute left-1/2 top-[47%] flex h-[37%] w-[37%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full px-[6%] text-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle at 44% 36%, rgba(36,29,18,0.85) 0%, rgba(10,9,8,0.9) 62%, rgba(5,5,5,0.95) 100%)' }}
          />
          <span className="relative block text-[clamp(0.5rem,0.95vw,0.6875rem)] font-medium uppercase leading-tight tracking-[0.16em] text-amber-200/80">
            {t('ui.core.returnedLabel')}
          </span>
          <span className="tnum relative mt-2 block font-mono text-[clamp(1rem,2.3vw,1.6rem)] font-light leading-none text-[color:var(--ink)]">
            {returnedToReserves === null
              ? '—'
              : formatCurrency(returnedToReserves, returnedToReserves > 0 && returnedToReserves < 0.01 ? 4 : 2)}
          </span>
          <span className="relative mt-2 block max-w-[16ch] text-[clamp(0.5rem,0.9vw,0.6875rem)] leading-snug text-zinc-500">
            {t('ui.core.returnedHint')}
          </span>
        </div>

        {basket.map((asset) => (
          <AssetNode asset={asset} key={asset.address} t={t} />
        ))}

        {loading && basket.length === 0 ? (
          <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
            {t('ui.core.reading')}
          </span>
        ) : null}
      </div>

    </div>
  );
}
