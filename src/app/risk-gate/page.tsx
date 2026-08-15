import type { Metadata } from 'next';
import { PublicShell } from '@/components/protocol/public-shell';

const SITE_URL = 'https://gblin.digital';
const PAGE_DESCRIPTION =
  'How to check the market risk regime (calm / elevated / crash) before an AI agent moves capital, and keep a signed attestation as portable proof the check happened — the pattern a third-party ERC-8004 agent already runs in production, without trusting us.';

export const metadata: Metadata = {
  title: { absolute: 'Check market risk before an AI agent moves capital — the Risk Gate pattern' },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/risk-gate` },
  openGraph: {
    title: 'Check market risk before an AI agent moves capital — the Risk Gate pattern',
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/risk-gate`,
    type: 'article',
  },
  keywords: [
    'risk gate pattern',
    'AI agent risk management',
    'ERC-8004',
    'EIP-712 attestation',
    'x402 payments',
    'agent decision rule',
    'verifiable AI agents',
    'Base mainnet',
  ],
};

const STEPS = [
  {
    n: '01',
    title: 'Verify the vendor before wiring it in',
    body: 'The agent checked four things about GBLIN, none of which require trusting our server: the data is EIP-712 signed (verify offline), the policy behind it is on-chain code behind a 48h timelock, the identity is registered (ERC-8004 #59286), and the payment trail is public USDC transfers on Base.',
  },
  {
    n: '02',
    title: 'Pin the feed as a required input',
    body: 'Its decision rule is a published file whose SHA-256 lives in its on-chain registration. That rule names GBLIN\'s risk regime as a required input: if the attestation says "crash", the agent stands down — whatever its own signal says.',
  },
  {
    n: '03',
    title: 'Buy fresh proof, not promises',
    body: 'Every cycle it buys a fresh attestation for $0.003 over x402 (10-minute freshness window) and records the purchase in an append-only, independently witnessed transparency log. If our endpoint goes down, that log says so — publicly, forever.',
  },
  {
    n: '04',
    title: 'Fail-open, but on the record',
    body: 'If the feed is unavailable the agent proceeds on its own signals, but writes "unavailable" into its public log. Vendor reliability stops being a promise and becomes a reputation with receipts.',
  },
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'The Risk Gate pattern — verifiable risk gating for AI agents',
  description: PAGE_DESCRIPTION,
  url: `${SITE_URL}/risk-gate`,
  publisher: { '@type': 'Organization', name: 'GBLIN Protocol', url: SITE_URL },
};

export default function RiskGatePage() {
  return (
    <PublicShell>
      <main className="min-h-screen bg-[#050505] text-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />

        {/* ───────── Hero ───────── */}
        <section className="px-6 pt-20 pb-14 sm:pt-28 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/5 text-xs text-emerald-300 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Running in production — every claim below is an on-chain query
          </div>
          <h1 className="text-4xl sm:text-6xl font-semibold leading-tight tracking-tight">
            The <span className="text-gradient">Risk Gate</span> pattern
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-3xl leading-relaxed">
            A third-party ERC-8004 agent (id <span className="text-amber-300 font-mono">59895</span> on
            Base — not operated by us, we have never spoken to its operator) made GBLIN&apos;s risk
            attestation a <em>hard dependency</em> of its published decision rule, and has bought it
            every day for a month. It never had to trust us. Here is the exact pattern, ready to copy.
          </p>
        </section>

        {/* ───────── The pattern ───────── */}
        <section className="px-6 py-14 border-t border-white/10">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">The pattern</h2>
            <div className="mt-10 grid sm:grid-cols-2 gap-4">
              {STEPS.map((s) => (
                <div key={s.n} className="border border-white/[0.07] bg-white/[0.02] rounded-xl p-6">
                  <div className="text-amber-400 font-mono text-sm">{s.n}</div>
                  <h3 className="mt-2 font-medium text-base">{s.title}</h3>
                  <p className="mt-2 text-sm text-white/60 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── Copy it ───────── */}
        <section className="px-6 py-14 border-t border-white/10">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Copy it in minutes</h2>
            <p className="mt-3 text-white/60 max-w-3xl">
              Three pieces: a gate in your system prompt, a verification call before you trust any
              reading, and a $0.003 x402 purchase when you need a signed proof you can hand to a
              counterparty.
            </p>

            <div className="mt-8 space-y-6">
              <div className="border border-white/[0.07] bg-white/[0.02] rounded-xl overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between border-b border-white/10">
                  <span className="font-medium text-sm">1 — The gate (system prompt / AGENTS.md)</span>
                  <span className="text-xs text-white/40 font-mono">any framework</span>
                </div>
                <pre className="p-5 text-sm text-white/80 overflow-x-auto leading-relaxed">
                  <code>{`Risk policy: before any action that deploys capital, fetch the GBLIN
market-risk regime. If the regime is "crash", stand down and hold —
whatever your own signals say. If the feed is unavailable, proceed
but log "risk feed unavailable" with a timestamp.`}</code>
                </pre>
              </div>

              <div className="border border-white/[0.07] bg-white/[0.02] rounded-xl overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between border-b border-white/10">
                  <span className="font-medium text-sm">2 — Read the regime + verify any attestation (free, MCP)</span>
                  <span className="text-xs text-white/40 font-mono">npx @gblin-protocol/mcp-server</span>
                </div>
                <pre className="p-5 text-sm text-white/80 overflow-x-auto leading-relaxed">
                  <code>{`const regime = await mcp.callTool({ name: "get_market_risk_regime", arguments: {} });
// → { regime: "calm" | "elevated" | "crash", severity_pct, defensive_cash_pct, ... }

// Never trust a forwarded attestation — verify it offline first:
const verdict = await mcp.callTool({
  name: "verify_risk_attestation",
  arguments: { attestation: theObjectYouWereHanded },
});
// recomputes the EIP-712 digest, recovers the signer, checks freshness + live drift`}</code>
                </pre>
              </div>

              <div className="border border-white/[0.07] bg-white/[0.02] rounded-xl overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between border-b border-white/10">
                  <span className="font-medium text-sm">3 — Buy a signed proof when you need receipts (x402)</span>
                  <span className="text-xs text-white/40 font-mono">$0.003 USDC on Base</span>
                </div>
                <pre className="p-5 text-sm text-white/80 overflow-x-auto leading-relaxed">
                  <code>{`GET https://gblin.digital/api/x402/attestation      # 402 → pay → signed EIP-712 payload
GET https://gblin.digital/api/x402/attestation-sample  # free static sample, same shape`}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Verify everything ───────── */}
        <section className="px-6 py-14 border-t border-white/10">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Don&apos;t take our word for any of this
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                {
                  k: 'The buyer exists and pays',
                  v: 'Agent id 59895 on the Base ERC-8004 registry; its daily $0.003 USDC transfers to our fee wallet are public on Base.',
                },
                {
                  k: 'The policy is code, not prose',
                  v: 'The Crash Shield parameters are readable on Basescan; every change goes through a 48-hour timelock.',
                },
                {
                  k: 'We hold ourselves to the same bar',
                  v: 'Our own uptime and honesty promises are pre-registered and sealed daily as EAS attestations on Base — the Coherence Proof. Reading it is free, forever.',
                },
                {
                  k: 'The sample is free',
                  v: 'Wire up parsing and offline verification against the free sample, then switch one URL to go live.',
                },
              ].map((r) => (
                <div key={r.k} className="border-l-2 border-amber-500/40 pl-5">
                  <h3 className="font-medium text-base">{r.k}</h3>
                  <p className="mt-2 text-sm text-white/70 leading-relaxed">{r.v}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href="https://gblin-mcp.gblin-mcp-worker.workers.dev/coherence"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-lg bg-amber-500 text-black font-medium text-sm hover:opacity-90 transition"
              >
                Live Coherence report
              </a>
              <a
                href="/agents"
                className="px-5 py-2.5 rounded-lg border border-white/20 text-sm hover:bg-white/5 transition"
              >
                All agent tools
              </a>
              <a
                href="https://github.com/gblinproject/GBLIN-MCP/tree/main/examples"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-lg border border-white/20 text-sm hover:bg-white/5 transition"
              >
                Starter examples on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
