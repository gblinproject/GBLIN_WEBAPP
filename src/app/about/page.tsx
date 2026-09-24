import type { Metadata } from 'next';
import { PublicShell } from '@/components/protocol/public-shell';

const SITE_URL = 'https://gblin.digital';
const PAGE_DESCRIPTION =
  'Who builds and operates GBLIN, who holds which power over the contracts, and how to reach the project. Every role below can be checked on Base.';

export const metadata: Metadata = {
  title: 'About',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'About',
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/about`,
    type: 'website',
  },
};

const OPERATOR = '0x9FFa542E369C53af62380296092EC669f329a9ee';
const TIMELOCK = '0x6aBeC8716fFeEcf7C3D6e68255b4797113E8e5Dd';
const GUARDIAN = '0x30590c0D05c26562d7296CE3D927d3418d2e6dcA';
const VAULT = '0xc2181d975c05c8c724b334bcED0764c0b86B1D53';
const SENTINEL = '0x9F13C5c46a864183e1c57Ec02837fe5B980D3F67';

const scan = (address: string) => `https://basescan.org/address/${address}`;
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

const ROLES: Array<{ role: string; holder: string; address: string; power: string }> = [
  {
    role: 'Owner of the vault and of the sequencer sentinel',
    holder: 'Timelock (48 hours)',
    address: TIMELOCK,
    power:
      'The only address that can change parameters, list or delist an asset, or replace a price feed, and only within the bounds written in the contract. Every change is scheduled in public and can be executed only after 48 hours.',
  },
  {
    role: 'Timelock proposer',
    holder: 'gblin.base.eth',
    address: OPERATOR,
    power: 'Schedules changes on the timelock. A scheduled change is visible on chain for 48 hours before it can take effect.',
  },
  {
    role: 'Timelock executor',
    holder: 'Anyone',
    address: TIMELOCK,
    power: 'Once the delay has passed, any address can execute a scheduled change. Nobody can execute one early.',
  },
  {
    role: 'Timelock canceller',
    holder: 'Project guardian key',
    address: GUARDIAN,
    power: 'Can cancel a scheduled change during the delay. Cannot schedule or execute one.',
  },
  {
    role: 'Sequencer sentinel guardian',
    holder: 'Project guardian key',
    address: GUARDIAN,
    power:
      'Can report the Base sequencer as down. While it reports down, the vault refuses mints and auction fills; redemptions are not affected. Pauses are budgeted: one stretch of at most 30 days, then a rest.',
  },
  {
    role: 'Fee recipient',
    holder: 'gblin.base.eth',
    address: OPERATOR,
    power: 'Receives the protocol fee, minted as shares. It has no other power over the vault.',
  },
];

const CANNOT = [
  "Move holders' assets.",
  'Mint shares to itself.',
  'Set a parameter outside the bounds written in the contract.',
  'Pause redemptions: redemption in kind reads no price feed, charges no fee and cannot be paused.',
  'Upgrade the code: the contracts are not proxies.',
  "Act without the timelock's 48-hour delay.",
];

const LINKS: Array<{ label: string; href: string }> = [
  { label: 'Specification and source code', href: 'https://github.com/gblinproject/GBLIN-Protocol' },
  { label: 'Deployments, roles and governance history', href: 'https://github.com/gblinproject/GBLIN-Protocol/blob/main/docs/deployments.md' },
  { label: 'Governance bounds', href: 'https://github.com/gblinproject/GBLIN-Protocol/blob/main/docs/governance.md' },
  { label: 'Security reviews and their limits', href: 'https://github.com/gblinproject/GBLIN-Protocol/blob/main/audits/README.md' },
  { label: 'Supply disclosure (total, circulating, project wallets)', href: `${SITE_URL}/api/supply` },
  { label: 'Vault on Basescan', href: scan(VAULT) },
  { label: 'Sequencer sentinel on Basescan', href: scan(SENTINEL) },
];

export default function AboutPage() {
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-400/80">About</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Who is behind GBLIN</h1>
        <p className="mt-4 text-base leading-8 text-zinc-300">
          GBLIN is an index token on Base: each token is a share of a basket of cbBTC, WETH and USDC held by the
          token contract, minted and redeemed at net asset value.
        </p>
        <p className="mt-3 text-base leading-8 text-zinc-300">
          GBLIN is built and operated by{' '}
          <a className="text-amber-200 underline-offset-4 hover:underline" href={scan(OPERATOR)} rel="noopener noreferrer" target="_blank">
            gblin.base.eth
          </a>
          , an independent builder who publishes under that onchain name. The name resolves to{' '}
          <span className="font-mono text-zinc-200">{short(OPERATOR)}</span>, the address that deployed the contracts, proposes every
          change to the timelock and receives the protocol fee, so the identity behind the project and the powers it
          holds can be checked on chain. Engineering and operations are AI-assisted and carried out in public; see{' '}
          <a className="text-amber-200 underline-offset-4 hover:underline" href="/operated-by-ai">
            Operated by AI
          </a>
          .
        </p>

        <h2 className="mt-12 text-xl font-semibold text-white">Who can do what</h2>
        <p className="mt-2 text-sm leading-7 text-zinc-400">Every role below is read from the contracts on Base, not stated by us.</p>
        <div className="mt-5 space-y-3">
          {ROLES.map((r) => (
            <div key={r.role} className="g-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-semibold text-white">{r.role}</p>
                <a className="font-mono text-xs text-amber-200 underline-offset-4 hover:underline" href={scan(r.address)} rel="noopener noreferrer" target="_blank">
                  {r.holder} · {short(r.address)}
                </a>
              </div>
              <p className="mt-2 text-sm leading-7 text-zinc-400">{r.power}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-xl font-semibold text-white">What no one can do</h2>
        <p className="mt-2 text-sm leading-7 text-zinc-400">Not the operator, not the timelock, not the guardian.</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-300">
          {CANNOT.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <h2 className="mt-12 text-xl font-semibold text-white">Contact</h2>
        <ul className="mt-4 space-y-2 text-sm leading-7 text-zinc-300">
          <li>
            General and security reports:{' '}
            <a className="text-amber-200 underline-offset-4 hover:underline" href="mailto:info@gblin.digital">
              info@gblin.digital
            </a>{' '}
            (the same address is the security contact written in the contracts' source).
          </li>
          <li>
            X:{' '}
            <a className="text-amber-200 underline-offset-4 hover:underline" href="https://x.com/GBLIN_Protocol" rel="noopener noreferrer" target="_blank">
              @GBLIN_Protocol
            </a>
          </li>
          <li>
            Source code:{' '}
            <a className="text-amber-200 underline-offset-4 hover:underline" href="https://github.com/gblinproject" rel="noopener noreferrer" target="_blank">
              github.com/gblinproject
            </a>
          </li>
        </ul>

        <h2 className="mt-12 text-xl font-semibold text-white">Documents</h2>
        <ul className="mt-4 space-y-2 text-sm leading-7">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a className="text-zinc-300 underline-offset-4 hover:text-amber-200 hover:underline" href={l.href} rel="noopener noreferrer" target="_blank">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </PublicShell>
  );
}
