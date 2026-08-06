import type { Metadata } from 'next';
import { ProtocolApp } from '@/components/protocol/protocol-app';

export const metadata: Metadata = {
  title: 'Dashboard — Live NAV, TVL & Basket Composition',
  description:
    'Live GBLIN dashboard: NAV per token, total value locked, basket weights (cbBTC / WETH / USDC) and stability fund — read directly from Base mainnet.',
  alternates: { canonical: 'https://gblin.digital/dashboard' },
};

export default function DashboardPage() {
  return <ProtocolApp view="dashboard" />;
}
