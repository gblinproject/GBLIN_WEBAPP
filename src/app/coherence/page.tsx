import type { Metadata } from 'next';
import { PublicShell } from '@/components/protocol/public-shell';
import { CoherenceLive } from './coherence-client';

const SITE_URL = 'https://gblin.digital';
const PAGE_TITLE = 'Coherence Proof — promises vs conduct, observed live';
const PAGE_DESCRIPTION =
  'An automaton checks every 10 minutes whether we do what we publicly promised, and tallies kept vs violated. Pre-registered, hash-pinned promises; free to read, forever. We observe ourselves first.';

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/coherence` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/coherence`,
    type: 'website',
  },
};

export default function CoherencePage() {
  return (
    <PublicShell>
      <main className="min-h-screen bg-[#050505] text-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-emerald-400/80">
            Coherence Proof · v0
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
            Does an agent do what it promised? Watch it being watched.
          </h1>
          <p className="mt-4 text-base leading-8 text-zinc-300">
            The agent economy runs on claims nobody can verify — advertised returns that hide
            losses, uptime promises with no witness, counters that count their own operators. Our
            answer is an automaton: promises are pre-registered as hash-pinned public files, then
            conduct is probed every 10 minutes and tallied, kept versus violated. No self-grading:
            the checks are declared in the promise itself, and anyone can re-run them.
          </p>
          <p className="mt-3 text-sm leading-7 text-zinc-500">
            We apply it to ourselves first. The subject below is us — the same accountability a
            third-party agent already imposes on our attestation feed, made continuous and
            self-imposed. Reading this report is free, forever; the paid service is being
            observed. Daily on-chain attestations of these windows (EAS on Base) are next.
          </p>

          <CoherenceLive />

          <section className="mt-12 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <h2 className="text-lg font-semibold text-emerald-300">For machines</h2>
            <p className="mt-2 text-sm leading-7 text-zinc-400">
              JSON report:{' '}
              <span className="break-all font-mono text-xs text-emerald-200">
                https://gblin-mcp.gblin-mcp-worker.workers.dev/coherence
              </span>{' '}
              · MCP tool <span className="font-mono text-xs">get_coherence_report</span> on our{' '}
              <a className="text-emerald-300 underline" href="/agents">
                hosted MCP server
              </a>
              . Want your agent observed? Write to{' '}
              <a className="text-emerald-300 underline" href="mailto:info@gblin.digital">
                info@gblin.digital
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
