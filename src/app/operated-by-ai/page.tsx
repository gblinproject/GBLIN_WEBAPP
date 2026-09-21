import type { Metadata } from 'next';
import { PublicShell } from '@/components/protocol/public-shell';

const SITE_URL = 'https://gblin.digital';
const PAGE_DESCRIPTION =
  'GBLIN is operated by AI in public: reviews, fixes and releases come from AI systems, the human founder only signs. Every claim links to verifiable evidence.';

export const metadata: Metadata = {
  title: 'Operated by AI — GBLIN Protocol Transparency',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/operated-by-ai` },
  openGraph: {
    title: 'Operated by AI — GBLIN Protocol Transparency',
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/operated-by-ai`,
    type: 'website',
  },
};

const EVIDENCE = [
  {
    claim: 'The risk policy is public code — and it has already acted on its own on mainnet.',
    detail:
      'On June 5, 2026 the Crash Shield of the previous index contract autonomously cut the WETH target weight from 45% to 9% after ETH crossed its drawdown threshold. No human intervened. The vault in service runs the same shield.',
    href: 'https://basescan.org/tx/0x896be221989930776972c78f81e2be9081c90d0027c14f7cd74bf51b9ad0acca',
    label: 'CrashShieldActivated tx on Basescan',
  },
  {
    claim: 'Governance is a 48h public timelock.',
    detail:
      'The previous index contract is owned by a 48-hour OpenZeppelin timelock, and the vault in service is bound to the same timelock through a scheduled acceptance. Every parameter change is scheduled in public, bounded in code, and executable only after the delay.',
    href: 'https://basescan.org/address/0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd',
    label: 'GblinTimelockController on Basescan',
  },
  {
    claim: 'The agent tooling is AI-built and published in public.',
    detail:
      'The open-source MCP server (13 tools, free by default) is maintained with AI-driven reviews and releases: each release is reviewed, corrected and published end-to-end by AI operations, with the human signing accounts only.',
    href: 'https://www.npmjs.com/package/@gblin-protocol/mcp-server',
    label: '@gblin-protocol/mcp-server on npm',
  },
  {
    claim: 'The protocol is listed in the official MCP Registry.',
    detail:
      'io.github.gblinproject/gblin-mcp-server — every version is published through the official mcp-publisher flow, with the hosted endpoint listed as a remote.',
    href: 'https://registry.modelcontextprotocol.io/v0/servers?search=gblin',
    label: 'MCP Registry entry',
  },
  {
    claim: 'All source code is public.',
    detail:
      'Contracts, webapp, MCP server, bots: every component that operates the protocol is open source and readable, including the history of AI-authored changes.',
    href: 'https://github.com/gblinproject',
    label: 'github.com/gblinproject',
  },
];

const DIVISION = [
  { who: 'AI operations', what: 'Reviews, code fixes, documentation, releases, risk analysis, strategy research, market monitoring, content drafting.' },
  { who: 'Autonomous contract', what: 'Target weights, Crash Shield activation and decay, fee accrual, the rebalancing auction — executed on-chain with no operator.' },
  { who: 'Human founder', what: 'Signs transactions (timelock schedule/execute, registrations), pushes releases, and can veto any scheduled change within the 48h window. Nothing else.' },
];

export default function OperatedByAiPage() {
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-400/80">Transparency</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Operated by AI, verified by chain</h1>
        <p className="mt-4 text-base leading-8 text-zinc-300">
          GBLIN is run as an experiment in machine-operated finance: the analysis, engineering and day-to-day
          operations are performed by AI systems, the balance sheet lives entirely on-chain, and the only human
          role is to sign. We do not ask anyone to trust this claim — every item below links to evidence that
          exists outside our control.
        </p>
        <p className="mt-3 text-sm leading-7 text-zinc-500">
          Honest scope: AI operation does not make the protocol risk-free, and GBLIN is volatile crypto exposure
          with a defensive policy — not a stablecoin and not financial advice. What AI operation changes is
          verifiability: policies are code, actions leave receipts.
        </p>

        <h2 className="mt-12 text-xl font-semibold text-white">Division of labor</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {DIVISION.map((d) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" key={d.who}>
              <p className="text-sm font-semibold text-amber-300">{d.who}</p>
              <p className="mt-2 text-sm leading-7 text-zinc-300">{d.what}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-xl font-semibold text-white">Claims and evidence</h2>
        <div className="mt-4 space-y-4">
          {EVIDENCE.map((e) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" key={e.label}>
              <p className="text-sm font-semibold text-white">{e.claim}</p>
              <p className="mt-2 text-sm leading-7 text-zinc-300">{e.detail}</p>
              <a
                className="mt-3 inline-block text-sm font-medium text-amber-300 underline decoration-amber-500/40 underline-offset-4 hover:text-amber-200"
                href={e.href}
                rel="noreferrer"
                target="_blank"
              >
                {e.label} ↗
              </a>
            </div>
          ))}
        </div>

        <p className="mt-12 text-sm leading-7 text-zinc-500">
          For a century, risk was an opinion you paid for. We are building it as an observable you verify:
          public policy code, signed risk attestations, and a treasury anyone can redeem in-kind at any time.
        </p>
      </div>
    </PublicShell>
  );
}
