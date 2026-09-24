'use client';

/**
 * Agent activity under the reserve core: paid calls since launch and calls today.
 *
 * Every figure counts EXTERNAL payers only: the wallets listed in promise P2 are excluded by the API,
 * so tests run from our own wallets never show up here. "Today" is counted in the reader's time zone
 * from the payment times the API returns, not from a server-side UTC day.
 *
 * A figure that could not be read is shown as a dash, never as zero: zero would claim that nobody
 * paid, which the page has not measured.
 */

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface Activity {
  calls: number;
  wallets: number;
  lastAt: string | null;
  recent: string[];
}

const STATS_URL = '/api/agent-stats';

function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function AgentActivity({ t, language }: { t: (key: string) => string; language: string }) {
  const [activity, setActivity] = useState<Activity | null>(null);
  // Set only in the browser, so the server render and the first client render agree.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(STATS_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((d) => {
        if (cancelled || d?.stale || !d?.organic) return;
        setActivity({
          calls: Number(d.organic.paid_calls ?? 0),
          wallets: Number(d.organic.unique_agents ?? 0),
          lastAt: d.organic.last_payment_at ?? null,
          recent: Array.isArray(d.organic.payment_times_48h) ? d.organic.payment_times_48h : [],
        });
      })
      .catch(() => undefined);
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, []);

  const ready = activity !== null && now !== null;
  const today = ready ? activity.recent.filter((ts) => Date.parse(ts) >= startOfToday(now)).length : null;
  const number = (n: number) => n.toLocaleString(language);

  // `text` marks a phrase ("47 minutes ago") rather than a figure: it is set smaller, in the text face,
  // on one line, so it never breaks into a column of words.
  const cells: Array<{ label: string; value: string | null; live?: boolean; text?: boolean }> = [
    { label: t('ui.activity.calls'), value: ready ? number(activity.calls) : null },
    { label: t('ui.activity.today'), value: today === null ? null : number(today) },
  ];

  return (
    <div className="relative mx-auto mt-6 w-full max-w-[360px] sm:mt-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-6 text-center">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0">
            {/* Labels sit on a two-line box aligned to its foot, so every figure starts on the same line. */}
            <dt className="g-eyebrow flex min-h-[3em] items-end justify-center text-[10px] leading-snug">{cell.label}</dt>
            <dd
              className={`mt-2 flex h-[1.5rem] items-center justify-center gap-2 whitespace-nowrap leading-none text-[color:var(--ink)] ${
                cell.text ? 'text-sm font-normal' : 'tnum font-mono text-[clamp(1.15rem,1.9vw,1.5rem)] font-light'
              }`}
            >
              {cell.live ? <span aria-hidden="true" className="gblin-blink h-1.5 w-1.5 rounded-full bg-amber-300" /> : null}
              <span className={cell.value === null ? 'animate-pulse text-zinc-600' : ''}>{cell.value ?? '—'}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-zinc-500">
        <span>{t('ui.activity.note')}</span>
        <span aria-hidden="true">·</span>
        <a className="inline-flex items-center gap-1 text-zinc-400 underline-offset-4 hover:text-amber-200 hover:underline" href={STATS_URL} rel="noopener noreferrer" target="_blank">
          {t('ui.activity.verify')}
          <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
