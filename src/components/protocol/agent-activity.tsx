'use client';

/**
 * Agent activity under the reserve core: paid calls and free MCP tool calls, since launch and today.
 *
 * Paid figures count EXTERNAL payers only: the wallets listed in promise P2 are excluded by the API,
 * so tests run from our own wallets never show up there. MCP figures come from the hosted server's
 * public counter, which has no caller identity, so our own checks are included; the note says so.
 * Both "today" columns are UTC days, so the two counters describe the same day.
 *
 * A figure that could not be read is shown as a dash, never as zero: zero would claim that nobody
 * called, which the page has not measured.
 */

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface Activity {
  paidTotal: number;
  paidToday: number;
  mcpTotal: number | null;
  mcpToday: number | null;
  mcpEveryDaySince: string | null;
}

const STATS_URL = '/api/agent-stats';

export function AgentActivity({ t, language }: { t: (key: string) => string; language: string }) {
  const [activity, setActivity] = useState<Activity | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(STATS_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((d) => {
        if (cancelled || d?.stale || !d?.organic) return;
        const mcp = d.free_mcp ?? null;
        setActivity({
          paidTotal: Number(d.organic.paid_calls ?? 0),
          paidToday: Number(d.organic_paid_today_utc ?? 0),
          mcpTotal: mcp ? Number(mcp.tool_calls_total) : null,
          mcpToday: mcp ? Number(mcp.tool_calls_today) : null,
          mcpEveryDaySince: mcp?.used_every_day_since ?? null,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const number = (n: number | null) => (n === null ? null : n.toLocaleString(language));
  const cells: Array<{ label: string; value: string | null }> = [
    { label: t('ui.activity.calls'), value: activity ? number(activity.paidTotal) : null },
    { label: t('ui.activity.paidToday'), value: activity ? number(activity.paidToday) : null },
    { label: t('ui.activity.mcp'), value: activity ? number(activity.mcpTotal) : null },
    { label: t('ui.activity.mcpToday'), value: activity ? number(activity.mcpToday) : null },
  ];

  const since = activity?.mcpEveryDaySince
    ? new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${activity.mcpEveryDaySince}T00:00:00Z`))
    : null;

  return (
    <div className="relative mx-auto mt-6 w-full max-w-[680px] sm:mt-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-6 text-center sm:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0">
            {/* Labels sit on a two-line box aligned to its foot, so every figure starts on the same line. */}
            <dt className="g-eyebrow flex min-h-[3em] items-end justify-center text-[10px] leading-snug">{cell.label}</dt>
            <dd className="tnum mt-2 flex h-[1.5rem] items-center justify-center font-mono text-[clamp(1.15rem,1.9vw,1.5rem)] font-light leading-none text-[color:var(--ink)]">
              <span className={cell.value === null ? 'animate-pulse text-zinc-600' : ''}>{cell.value ?? '—'}</span>
            </dd>
          </div>
        ))}
      </dl>
      {since ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-zinc-300">
          <span aria-hidden="true" className="gblin-blink h-1.5 w-1.5 rounded-full bg-amber-300" />
          {t('ui.activity.everyDay').replace('{date}', since)}
        </p>
      ) : null}
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-zinc-500">
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
