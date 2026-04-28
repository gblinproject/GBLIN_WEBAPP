import type { Metadata } from 'next';
import { ProtocolApp } from '@/components/protocol/protocol-app';

export const metadata: Metadata = {
  title: 'Dashboard — Live NAV, TVL & Basket Composition',
  description:
    'Real-time GBLIN dashboard: NAV per token, total value locked, basket weights (cbBTC / WETH / USDC), stability fund, and dynamic reserve. All data sourced directly from Base Mainnet.',
  alternates: { canonical: 'https://gblin.digital/dashboard' },
};

export default function DashboardPage() {
  return <ProtocolApp view="dashboard" />;
}
