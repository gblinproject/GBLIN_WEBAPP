import type { Metadata } from 'next';
import { PublicShell } from '@/components/protocol/public-shell';
import { TreasuryPlanner } from '@/components/protocol/treasury-planner';

const SITE_URL = 'https://gblin.digital';
const PAGE_DESCRIPTION =
  'Enter a wallet and a daily spend: see the USDC to keep liquid, the surplus above it, and a simulation of minting that surplus into GBLIN at NAV with every fee read live and the estimated exit value today. Nothing is executed.';

export const metadata: Metadata = {
  title: { absolute: 'Treasury plan: idle USDC, operating cash and a GBLIN simulation' },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/treasury` },
  openGraph: {
    title: 'Treasury plan for idle USDC on Base',
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/treasury`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Treasury plan for idle USDC on Base',
    description: PAGE_DESCRIPTION,
  },
};

export default function TreasuryPage() {
  return (
    <PublicShell>
      <main className="min-h-screen bg-[#050505] text-white">
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-10 sm:pt-28">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Idle USDC, <span className="text-gradient">one plan</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/70">
            Keep the cash you spend in USDC. The rest is a candidate for GBLIN, a basket of cbBTC, WETH and USDC
            minted and redeemed at NAV. This page reads your wallet and the vault, shows the simulation with every
            fee and the cost of exiting today, and stops there: minting is your decision, in your wallet.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-white/50">
            The same plan is one call for an agent: <code className="text-white/70">GET /api/x402/plan</code> over
            HTTP, or the <code className="text-white/70">plan_treasury</code> tool of the MCP server. GBLIN is not a
            stablecoin and carries no yield: its value moves with cbBTC and WETH.
          </p>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-24">
          <TreasuryPlanner />
        </section>
      </main>
    </PublicShell>
  );
}
