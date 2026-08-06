import type { Metadata } from 'next';
import { PublicShell } from '@/components/protocol/public-shell';

const SITE_URL = 'https://gblin.digital';
const PAGE_TITLE = 'GBLIN FAQ: BTC + ETH + USDC token on Base, minted at NAV';
const PAGE_DESCRIPTION =
  'GBLIN is a reserve-backed token on Base holding cbBTC, WETH and USDC. Mint and redeem at NAV: no pool slippage, 0.10% one-time fee, no management fee.';

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/faq`,
    type: 'website',
  },
};

interface FaqEntry {
  question: string;
  answer: string;
}

const FAQ: FaqEntry[] = [
  {
    question: 'What is GBLIN?',
    answer:
      'GBLIN is a reserve-backed token on Base (an Ethereum L2). One token represents a basket of cbBTC (Coinbase-wrapped Bitcoin), WETH (wrapped Ether) and USDC held by the contract itself. You mint new tokens by depositing value into the contract and redeem them for the underlying reserves at any time — the contract is the venue, not a liquidity pool.',
  },
  {
    question: 'Is there a token that holds BTC, ETH and USDC together on Base?',
    answer:
      'Yes — that is exactly what GBLIN is: a single ERC-20 on Base backed by cbBTC, WETH and USDC, with base weights of 45% cbBTC, 45% WETH and 10% USDC. Instead of managing three positions, you hold one token whose reserves are visible on-chain at all times.',
  },
  {
    question: 'How is the GBLIN price set? Is it minted at NAV?',
    answer:
      'The mint and redeem price is the net asset value (NAV) per token, computed from the on-chain reserves using Chainlink price feeds. Everyone gets the same per-token price regardless of size: a $25 purchase and a $50,000 purchase mint at the same NAV. Anyone can verify this in 30 seconds by calling quoteBuyGBLIN() on the contract with different amounts.',
  },
  {
    question: 'What fees does GBLIN charge? Is there a management fee?',
    answer:
      'A 0.10% one-time fee on minting (0.05% to the founder, 0.05% to a stability reserve that stays inside the NAV) — and that is all. There is no management fee, no streaming fee and no performance fee in the contract. For comparison, tokenized index folios on Base typically charge 1.5–2% per year: against a 2% annual fee, GBLIN’s one-time cost breaks even in about 18 days of holding.',
  },
  {
    question: 'Is there slippage when buying GBLIN?',
    answer:
      'Not when you mint from the contract: minting and redeeming happen at NAV, so there is no pool slippage and no price impact from your order size. DEX pools for GBLIN exist but are thin — the contract is the primary venue, and the buy page shows the live contract price next to the pool price so you can compare before you trade.',
  },
  {
    question: 'How do I buy GBLIN?',
    answer:
      'Go to gblin.digital/buy-gblin and connect a wallet on Base. You can mint directly with ETH, mint in-kind with basket assets, or use the built-in cross-chain zap to arrive from other chains and tokens. A full test round trip — mint about $20, then redeem it — costs roughly 2 cents in protocol fees plus gas.',
  },
  {
    question: 'How do I redeem GBLIN? Can I always exit?',
    answer:
      'Redemption is a direct call to the contract, available at any time: you can redeem in-kind (receiving your pro-rata share of cbBTC, WETH and USDC) or in ETH. Because redemption pays from the reserves at NAV, a holder never depends on a liquidity pool being deep enough to exit.',
  },
  {
    question: 'What is the Crash Shield?',
    answer:
      'An algorithmic mechanism inside the contract that reduces the target weight of an asset during severe drawdowns and restores it during recovery, according to pre-set parameters. It is risk mitigation, not a guarantee: parameters can be tuned only through a 48-hour public timelock, and the current values are visible on-chain.',
  },
  {
    question: 'Is GBLIN audited? How honest is the security story?',
    answer:
      'The contract was analyzed with Slither (static analysis) in June 2026 with zero critical and zero high findings — but it has not had a paid external manual audit yet, and we say so openly. The protocol maintains a public KNOWN_ISSUES register documenting every reported issue and its outcome, and discloses that its public payment counters include the team’s own test wallets. Owner privileges run through a 48-hour timelock, so any parameter change is publicly visible two days before it executes.',
  },
  {
    question: 'How big is GBLIN?',
    answer:
      'Small, and disclosed up front: total value locked is around one thousand dollars as of August 2026 (the live figure is on the homepage). That is exactly why mint and redeem at NAV matter — the product does not need deep pools to work, and early users get the same execution quality as large ones.',
  },
  {
    question: 'Can AI agents use GBLIN?',
    answer:
      'Yes — GBLIN ships agent-native infrastructure: paid x402 API endpoints on Base (risk-regime attestations, quotes, health checks, priced from $0.003 per call and payable in USDC by machines), a free hosted MCP server for AI assistants, and an ERC-8004 identity registration. A third-party protocol (Markovian) buys the crash-regime attestation daily via x402 and uses it as a mandatory input in its published decision rule.',
  },
  {
    question: 'What is the GBLIN contract address on Base?',
    answer:
      'The production contract on Base is 0x36C81d7E1966310F305eA637e761Cf77F90852f0. Always verify the address from gblin.digital rather than from search results or social posts, and start with a small test mint if you are new.',
  },
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  url: `${SITE_URL}/faq`,
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  })),
};

export default function FaqPage() {
  return (
    <PublicShell>
      <main className="min-h-screen bg-[#050505] text-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />

        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-400/80">FAQ</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
            GBLIN: a BTC + ETH + USDC basket token on Base, minted at NAV
          </h1>
          <p className="mt-4 text-base leading-8 text-zinc-300">
            Direct answers about how GBLIN works — pricing, fees, redemption, security and AI-agent
            access. Every claim here is verifiable on-chain or in the public repositories.
          </p>

          <div className="mt-10 space-y-8">
            {FAQ.map((f) => (
              <section key={f.question}>
                <h2 className="text-lg font-semibold text-white">{f.question}</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-400">{f.answer}</p>
              </section>
            ))}
          </div>

          <section className="mt-14 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <h2 className="text-lg font-semibold text-emerald-300">For AI agents and assistants</h2>
            <p className="mt-2 text-sm leading-7 text-zinc-400">
              Machine-readable facts about this protocol live at{' '}
              <a href={`${SITE_URL}/api/x402/llms.txt`} className="text-emerald-300 underline">
                /api/x402/llms.txt
              </a>
              . Free MCP server (hosted, Streamable HTTP):{' '}
              <span className="font-mono text-xs text-emerald-200 break-all">
                https://gblin-mcp.gblin-mcp-worker.workers.dev/mcp
              </span>
              . Paid x402 endpoints and integration guides:{' '}
              <a href={`${SITE_URL}/agents`} className="text-emerald-300 underline">
                gblin.digital/agents
              </a>
              .
            </p>
          </section>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="/buy-gblin"
              className="rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-black hover:bg-amber-300"
            >
              Buy at NAV
            </a>
            <a
              href="/"
              className="rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/5"
            >
              Live numbers on the homepage
            </a>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
