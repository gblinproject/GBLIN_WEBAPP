import type { Metadata } from 'next';
import { PublicShell } from '@/components/protocol/public-shell';

const SITE_URL = 'https://gblin.digital';
const PAGE_DESCRIPTION =
  'Terms of use for the GBLIN protocol and website. GBLIN is open-source software and volatile on-chain crypto exposure with a defensive risk policy — not a stablecoin, not investment advice, and not a custodial service.';

export const metadata: Metadata = {
  title: 'Terms of Use — GBLIN Protocol',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    title: 'Terms of Use — GBLIN Protocol',
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/terms`,
    type: 'website',
  },
};

const LAST_UPDATED = 'July 18, 2026';

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: '1. What GBLIN is',
    p: [
      'GBLIN is an open-source smart-contract protocol deployed on the Base network. It issues a token backed by a treasury of on-chain assets (WETH, cbBTC, USDC) and runs an autonomous risk policy (the "Crash Shield"). The contract is verified on Basescan and its source code is public.',
      'This website is an interface to that protocol. It does not hold your funds, does not take custody of assets, and cannot move tokens on your behalf. Every transaction is initiated and signed by you from your own wallet.',
    ],
  },
  {
    h: '2. No financial advice',
    p: [
      'Nothing on this website or in the protocol documentation is investment, financial, legal, or tax advice. GBLIN is volatile crypto exposure with a defensive policy — it is not a stablecoin and its value can fall, including to zero. Past behavior of the protocol, including any historical activation of the Crash Shield or any backtest shown on this site, is not a promise or prediction of future results.',
      'You are solely responsible for evaluating the risks and for any decision to acquire, hold, or redeem GBLIN.',
    ],
  },
  {
    h: '3. No custody, no guarantees',
    p: [
      'The protocol is provided "as is", without warranties of any kind. Smart-contract software can contain bugs. No third-party security audit has been commissioned as of the date of these terms; you should not assume the code is free of defects.',
      'Governance of the production contract is held by a 48-hour public timelock. Parameter changes are announced on-chain and become executable only after the delay. This reduces, but does not eliminate, governance risk.',
    ],
  },
  {
    h: '4. Your responsibilities',
    p: [
      'You are responsible for the security of your wallet and private keys, for complying with the laws of your jurisdiction, and for confirming that interacting with a decentralized protocol is permitted where you live. Do not use GBLIN if it is unlawful for you to do so.',
    ],
  },
  {
    h: '5. Limitation of liability',
    p: [
      'To the maximum extent permitted by law, the GBLIN project, its contributors, and the operators of this website are not liable for any loss arising from the use of the protocol or this interface, including losses from market movements, smart-contract failure, network issues, or third-party services.',
    ],
  },
  {
    h: '6. Changes and contact',
    p: [
      'These terms may be updated; the "last updated" date above reflects the current version. Questions can be sent to info@gblin.digital.',
    ],
  },
];

export default function TermsPage() {
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-400/80">Legal</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Terms of Use</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: {LAST_UPDATED}</p>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold text-white">{s.h}</h2>
              {s.p.map((para, i) => (
                <p className="mt-3 text-sm leading-7 text-zinc-300" key={i}>
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>

        <p className="mt-12 text-sm leading-7 text-zinc-500">
          GBLIN is open-source software and volatile crypto exposure with a defensive policy — not a stablecoin
          and not financial advice.
        </p>
      </div>
    </PublicShell>
  );
}
