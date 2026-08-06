'use client';

/**
 * NavFees — the share of buyers' fees that stayed in the reserves and lifted
 * the NAV for every holder, summed from the contract's YieldDistributed events.
 *
 * The figure is published wherever it has context (the fee section, the vault),
 * and promotes itself into the hero only once it clears PROMOTE_USD. Next to a
 * four-figure NAV per token, a cumulative figure of a few cents reads as "this
 * is all the project ever produced" — the same reason the lifetime x402 revenue
 * lives on /observatory rather than in the hero. Nothing is hidden: the number
 * is one click away, and it moves up on its own as purchases accumulate.
 */

import { useEffect, useState } from 'react';

/** Above this, in US dollars, the figure earns a place in the hero. */
const PROMOTE_USD = 50;

export interface NavFees {
  weth: number;
  usd: number;
  events: number;
  ethUsd: number;
  updatedAt: number;
}

export function useNavFees(): NavFees | null {
  const [data, setData] = useState<NavFees | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/nav-fees')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((payload: NavFees) => {
        if (cancelled) return;
        if (Number.isFinite(payload?.usd) && payload.events > 0) setData(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}

/** US dollars, with cents while the total is still small. */
export function formatFeeUsd(usd: number): string {
  return usd < 100
    ? `$${usd.toFixed(2)}`
    : `$${Math.round(usd).toLocaleString('en-US')}`;
}

/**
 * Hero strip. Always states the mechanism; adds the running total only once it
 * is large enough to help rather than undercut.
 */
export function NavFeesHeroLine({ t }: { t: (key: string) => string }) {
  const fees = useNavFees();
  const promoted = fees !== null && fees.usd >= PROMOTE_USD;

  return (
    <div className="mt-6 border-t border-white/[0.07] pt-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">
        {t('landing.feeMechLabel')}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-zinc-400">{t('landing.feeMechBody')}</p>
      {promoted && fees ? (
        <p className="mt-3 font-serif text-2xl leading-none tracking-tight text-amber-400">
          {formatFeeUsd(fees.usd)}{' '}
          <span className="font-sans text-[11px] font-normal tracking-normal text-zinc-500">
            {t('landing.feeMechSoFar')}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * In-context figure for the fee section: shown at any size, because there the
 * mechanism around it explains what the number is and why it is small.
 */
export function NavFeesInline({ t }: { t: (key: string) => string }) {
  const fees = useNavFees();
  if (!fees) return null;

  return (
    <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.26em] text-zinc-500">
        {t('feeEngine.liveLabel')}
      </p>
      <p className="mt-2 font-serif text-3xl leading-none tracking-tight text-amber-400">
        {formatFeeUsd(fees.usd)}
      </p>
      <p className="mt-2 text-[11px] font-mono text-zinc-500">
        {fees.weth.toFixed(6)} WETH · {fees.events.toLocaleString('en-US')} {t('feeEngine.liveEvents')}
      </p>
      <p className="mt-3 max-w-2xl text-[11px] leading-5 text-zinc-500">{t('feeEngine.liveNote')}</p>
    </div>
  );
}
