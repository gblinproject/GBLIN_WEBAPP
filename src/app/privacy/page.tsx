import type { Metadata } from 'next';
import { PublicShell } from '@/components/protocol/public-shell';

const SITE_URL = 'https://gblin.digital';
const PAGE_DESCRIPTION =
  'Privacy policy for the GBLIN website. GBLIN is a non-custodial interface to an on-chain protocol. It does not collect accounts or personal profiles; wallet interactions happen directly on the public Base blockchain.';

export const metadata: Metadata = {
  title: 'Privacy Policy — GBLIN Protocol',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: 'Privacy Policy — GBLIN Protocol',
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/privacy`,
    type: 'website',
  },
};

const LAST_UPDATED = 'July 18, 2026';

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: 'Summary',
    p: [
      'GBLIN is a non-custodial interface to a public smart-contract protocol on Base. We do not run user accounts, we do not ask for names or emails to use the app, and we do not sell data. This page explains the little data that is involved.',
    ],
  },
  {
    h: 'What we do not collect',
    p: [
      'No sign-up, no password, no personal profile. The website does not create an account for you. Connecting a wallet does not share your identity with us — it shares a public blockchain address, which you choose to connect.',
    ],
  },
  {
    h: 'On-chain data is public by design',
    p: [
      'When you transact with the protocol, the transaction is recorded on the Base blockchain, which is public and outside our control. Your wallet address and its activity are visible to anyone via a block explorer. This is a property of public blockchains, not something this site adds.',
    ],
  },
  {
    h: 'Third-party infrastructure',
    p: [
      'To display live data the site reads from public infrastructure such as RPC providers, block explorers (Basescan/Blockscout), and market-data APIs. These providers may log standard request metadata (for example an IP address) under their own privacy policies. Hosting is provided by Vercel, which may collect standard server and analytics logs.',
      'If you use the optional fiat on-ramp, that flow is handled by a third-party provider under its own terms and privacy policy; any identity verification happens with them, not with us.',
    ],
  },
  {
    h: 'Local storage',
    p: [
      'The site may store small preferences (such as your chosen language) in your browser. This stays on your device and is not transmitted to us as a personal profile.',
    ],
  },
  {
    h: 'Contact',
    p: [
      'Questions about privacy can be sent to info@gblin.digital. This policy may be updated; the date above reflects the current version.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-400/80">Legal</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Privacy Policy</h1>
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
          Non-custodial by design: the protocol never holds your keys, and this site never asks for an account.
        </p>
      </div>
    </PublicShell>
  );
}
