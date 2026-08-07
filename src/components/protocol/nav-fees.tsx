'use client';

/**
 * NavFees — the share of buyers' fees that stayed in the reserves and lifted
 * the NAV for every holder, summed from the contract's YieldDistributed events.
 *
 * It leads the hero, by the founder's call: the claim above it ("the vault
 * never takes, it adds") is what gives the figure its meaning, and the count
 * of distributions underneath shows it is a running total rather than a
 * one-off. Small today; it only ever grows, and it belongs to holders.
 */

import { useEffect, useState } from 'react';

export interface NavFees {
  weth: number;
  usd: number;
  events: number;
  ethUsd: number;
  updatedAt: number;
}

/**
 * Reads the figure, retrying a few times before giving up. The upstream log
 * source throttles, and this number leads the hero: one unlucky request must
 * not leave a dash sitting where the headline figure belongs.
 */
export function useNavFees(): NavFees | null {
  const [data, setData] = useState<NavFees | null>(null);

  useEffect(() => {
    let cancelled = false;

    const attempt = async (left: number): Promise<void> => {
      if (cancelled) return;
      try {
        const res = await fetch('/api/nav-fees');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as NavFees;
        if (cancelled) return;
        if (Number.isFinite(payload?.usd) && payload.events > 0) {
          setData(payload);
          return;
        }
        throw new Error('payload without a usable figure');
      } catch {
        if (cancelled || left <= 0) return;
        await new Promise(resolve => setTimeout(resolve, 2_000));
        return attempt(left - 1);
      }
    };

    void attempt(3);
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
 * Hero ledger: what the protocol has taken from holders, next to what it has
 * given back. The left column is a constant zero by design; the right one is
 * live. If the log source is unreachable the right column degrades to a dash
 * and the mechanism sentence still stands on its own.
 */
export function NavFeesHeroLedger({ t }: { t: (key: string) => string }) {
  const fees = useNavFees();

  return (
    <div className="mt-6 border-t border-white/[0.07] pt-5">
      <div className="flex items-start gap-2">
        <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-400/80">
          {t('landing.ledgerEyebrow')}
        </p>
      </div>

      <div className="mt-4">
        <p className="font-serif text-[clamp(2rem,7vw,2.8rem)] leading-none tracking-tight text-amber-400">
          {fees ? formatFeeUsd(fees.usd) : '—'}
        </p>
        <p className="mt-2 text-[11px] leading-5 text-zinc-400">
          {t('landing.ledgerGiven')}
          {fees ? (
            <span className="block text-zinc-500">
              {fees.events.toLocaleString('en-US')} {t('landing.ledgerTimes')}
            </span>
          ) : null}
        </p>
      </div>

      <p className="mt-4 text-[11px] leading-5 text-zinc-500">{t('landing.feeMechBody')}</p>
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
