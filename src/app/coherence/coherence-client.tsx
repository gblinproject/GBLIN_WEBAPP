'use client';

/**
 * Live view over the Coherence automaton (Cloudflare Worker, /coherence).
 * Renders nothing alarming while observation hasn't started: promises enter
 * force only once their files are public, and the page says so plainly.
 */

import { useEffect, useState } from 'react';

const REPORT_URL = 'https://gblin-mcp.gblin-mcp-worker.workers.dev/coherence';

interface PromiseRow {
  id: string;
  promiseId: string;
  file: string;
  observations: number;
  kept: number;
  violations: number;
  kept_bps: number | null;
  last_observation: string | null;
  last_status: 'kept' | 'violated' | null;
}

interface Report {
  subject: string;
  promises: PromiseRow[];
  observing_since: string | null;
  method: string;
}

export function CoherenceLive() {
  const [report, setReport] = useState<Report | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(REPORT_URL)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((data: Report) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <p className="mt-8 text-sm leading-7 text-zinc-500">
        The automaton is unreachable right now. That is itself an observation — try again in a
        minute, or query the report directly at{' '}
        <a className="text-emerald-300 underline" href={REPORT_URL}>
          {REPORT_URL}
        </a>
        .
      </p>
    );
  }

  if (!report) {
    return (
      <div className="mt-8 space-y-2">
        <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {report.observing_since ? (
        <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-emerald-400/80">
          Observing since {new Date(report.observing_since).toUTCString()}
        </p>
      ) : (
        <p className="text-sm leading-7 text-zinc-400">
          Observation has not started yet: a promise enters force only once its file is public.
          The automaton is deployed and will begin tallying at the first cycle after publication.
        </p>
      )}

      {report.promises.map(p => (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6" key={p.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-white">{p.id}</p>
            {p.kept_bps !== null ? (
              <p className={`font-serif text-2xl leading-none ${p.violations === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {(p.kept_bps / 100).toFixed(2)}% kept
              </p>
            ) : (
              <p className="text-xs text-zinc-500">no observations yet</p>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-500">
            {p.observations.toLocaleString('en-US')} observations · {p.kept.toLocaleString('en-US')} kept ·{' '}
            {p.violations.toLocaleString('en-US')} violations
            {p.last_observation ? ` · last: ${p.last_status} at ${new Date(p.last_observation).toUTCString()}` : ''}
          </p>
          <p className="mt-3 break-all font-mono text-[10px] text-zinc-600">
            promiseId {p.promiseId}
          </p>
          <a
            className="mt-2 inline-block text-[11px] font-semibold text-emerald-300/80 underline"
            href={p.file}
            rel="noopener noreferrer"
            target="_blank"
          >
            Read the pre-registered promise
          </a>
        </div>
      ))}
    </div>
  );
}
