import type { Metadata } from 'next';
import { PublicShell } from '@/components/protocol/public-shell';
import { GblinNumbers, LiveSection } from './observatory-client';

const SITE_URL = 'https://gblin.digital';
const PAGE_DESCRIPTION =
  'Measured data on agentic commerce: live x402 Bazaar probes, dated snapshots, third-party research and the Organic Agent Commerce Ratio. Free, CC BY 4.0.';

export const metadata: Metadata = {
  title: 'Agent Economy Observatory — GBLIN Protocol',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/observatory` },
  openGraph: {
    title: 'Agent Economy Observatory — GBLIN Protocol',
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/observatory`,
    type: 'website',
  },
};

const SNAPSHOT = [
  { value: '14,381', label: 'services listed on the x402 Bazaar' },
  { value: '52%', label: 'of listed endpoints unreachable when probed' },
  { value: '2,503', label: 'wallets that have ever paid anything' },
  { value: '68%', label: 'of all volume flows to just 3 endpoints' },
  { value: '-96%', label: 'weekly volume versus its peak' },
  { value: '$0.014', label: 'median listed price per call' },
];

const RESEARCH = [
  {
    title: 'ERC-8004 under the microscope (arXiv 2606.12128)',
    detail:
      'Independent measurement study of 10,000 registered on-chain agents: only 0.67% expose a service endpoint, 6.3% have any feedback at all, just 19 agents are fully operational — and a single client generates 65.8% of all reputation records.',
    href: 'https://arxiv.org/abs/2606.12128',
    label: 'arxiv.org/abs/2606.12128',
    source: 'arXiv, June 2026',
  },
  {
    title: 'x402 demand is not there yet (CoinDesk / Artemis)',
    detail:
      'CoinDesk, citing Artemis data (March 11, 2026): real x402 volume runs around $28,000 per day, and roughly 50% of observed transactions are estimated to be self-dealing or wash trading rather than genuine agent commerce.',
    href: 'https://www.coindesk.com/markets/2026/03/11/coinbase-backed-ai-payments-protocol-wants-to-fix-micropayment-but-demand-is-just-not-there-yet',
    label: 'coindesk.com — March 11, 2026',
    source: 'CoinDesk / Artemis, 2026-03-11',
  },
];

export default function ObservatoryPage() {
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-400/80">Observatory</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Agent Economy Observatory</h1>
        <p className="mt-4 text-base leading-8 text-zinc-300">
          Separating signal from noise in agentic commerce. Free, public, machine-readable.
        </p>
        <p className="mt-3 text-sm leading-7 text-zinc-500">
          Headline numbers about the &ldquo;agent economy&rdquo; are easy to inflate: listings that answer
          nothing, volume that pays itself, reputation written by one client. This observatory publishes what
          we can actually verify — live probes, dated snapshots with method, and third-party research — and
          discloses our own position in the data it measures.
        </p>

        {/* ── GBLIN's own numbers ───────────────────────────────────────
            Sits first because it is the only block on this page whose every
            figure settles on-chain. The conflict-of-interest note travels with
            it and must never be separated from the numbers it qualifies. */}
        <h2 className="mt-12 text-xl font-semibold text-white">Paid agent calls received by GBLIN</h2>
        <GblinNumbers />
        <p className="mt-4 text-sm leading-7 text-zinc-400">
          Conflict of interest, disclosed plainly: GBLIN operates 11 paid x402 endpoints, so we are a
          participant in the market this observatory measures. Our numbers are on-chain-verifiable (USDC
          transfers to the fee wallet on Base), our own traffic is excluded from the organic counts below, and
          we never inflate Bazaar statistics with self-calls.
        </p>

        {/* ── OACR ─────────────────────────────────────────────────────── */}
        <h2 className="mt-12 text-xl font-semibold text-white">The metric: Organic Agent Commerce Ratio (OACR)</h2>
        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
          <p className="text-sm font-semibold text-amber-300">
            OACR — a definition we publish openly for anyone to adopt
          </p>
          <p className="mt-2 text-sm leading-7 text-zinc-300">
            Share of agent-economy activity that is verifiably organic: reachable endpoints &times; unique
            external payers &times; non-self-dealing volume, as a fraction of headline figures.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Status: v0 — the components are published separately below; a composite index is planned. We do not
            publish a composite number we cannot yet defend.
          </p>
        </div>

        {/* ── Live probe (client-side; degrades to snapshot) ───────────── */}
        <LiveSection />

        {/* ── Dated snapshot ───────────────────────────────────────────── */}
        <h2 className="mt-12 text-xl font-semibold text-white">Verified snapshot — July 27, 2026</h2>
        <p className="mt-2 text-sm leading-7 text-zinc-400">
          Our primary research: full Bazaar catalog download plus reachability probe, performed 2026-07-27.
          These are dated constants, not live numbers.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {SNAPSHOT.map((s) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" key={s.label}>
              <p className="text-2xl font-semibold text-white">{s.value}</p>
              <p className="mt-1 text-sm leading-6 text-zinc-300">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── External research ─────────────────────────────────────────── */}
        <h2 className="mt-12 text-xl font-semibold text-white">External research</h2>
        <div className="mt-4 space-y-4">
          {RESEARCH.map((r) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" key={r.href}>
              <p className="text-sm font-semibold text-white">{r.title}</p>
              <p className="mt-2 text-sm leading-7 text-zinc-300">{r.detail}</p>
              <a
                className="mt-3 inline-block text-sm font-medium text-amber-300 underline decoration-amber-500/40 underline-offset-4 hover:text-amber-200"
                href={r.href}
                rel="noreferrer"
                target="_blank"
              >
                {r.label} ↗
              </a>
            </div>
          ))}
        </div>

        {/* ── Methodology ───────────────────────────────────────────────── */}
        <h2 className="mt-12 scroll-mt-24 text-xl font-semibold text-white" id="methodology">
          Methodology
        </h2>
        <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-300">
          <p>
            <span className="font-semibold text-white">Snapshot (2026-07-27).</span> We downloaded the full
            Coinbase x402 Bazaar discovery catalog and probed every listed resource URL. Counts, price
            distribution and volume concentration were computed over the complete catalog, cross-checked
            against public on-chain data for payer counts.
          </p>
          <p>
            <span className="font-semibold text-white">Live probe.</span> The API fetches up to 5 pages of
            Bazaar listings (5s timeout each), then samples up to 20 random listed URLs with a GET request and
            a 2.5s timeout. An endpoint counts as <em>reachable</em> if it answers with any HTTP status below
            500 — a 402 payment-required reply is a working endpoint. If any part of the probe fails, the API
            returns <code className="rounded bg-white/10 px-1">live: null</code> with an error reason; we never
            fabricate live numbers.
          </p>
          <p>
            <span className="font-semibold text-white">Organic counts.</span> GBLIN&rsquo;s own endpoints and
            any self-originated calls are excluded from organic activity figures. Integrity statement: we do
            not issue payments to our own endpoints to inflate Bazaar rankings or call counts — the only
            exception ever made is a single paid call to refresh stale listing metadata, which we document.
          </p>
          <p>
            <span className="font-semibold text-white">Reuse.</span> All observatory data is free to reuse with
            attribution under CC BY 4.0 — cite &ldquo;GBLIN Agent Economy Observatory&rdquo;.
          </p>
        </div>

        <p className="mt-12 text-sm leading-7 text-zinc-500">
          Machine-readable JSON:{' '}
          <a
            className="font-medium text-amber-300 underline decoration-amber-500/40 underline-offset-4 hover:text-amber-200"
            href="/api/observatory"
          >
            gblin.digital/api/observatory
          </a>{' '}
          — free, CORS-enabled, cached 24h. License: CC BY 4.0.
        </p>
      </div>
    </PublicShell>
  );
}
