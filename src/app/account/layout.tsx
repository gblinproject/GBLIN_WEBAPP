import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account — Your GBLIN Portfolio & On-Chain Activity',
  description:
    'Your personal GBLIN dashboard: wallet balance, mint and redeem flow, on-chain transaction history, and live PnL on the diversified Base basket.',
  alternates: { canonical: 'https://gblin.digital/account' },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
