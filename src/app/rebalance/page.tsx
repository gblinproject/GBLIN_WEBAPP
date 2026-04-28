import type { Metadata } from 'next';
import { ProtocolApp } from '@/components/protocol/protocol-app';

export const metadata: Metadata = {
  title: 'Rebalance GBLIN — Earn ETH for Maintaining the Index',
  description:
    'Anyone can call incentivizedRebalance() and earn 0.0001 ETH from the stability fund when the GBLIN basket drifts off-target. Permissionless keeper economy on Base.',
  alternates: { canonical: 'https://gblin.digital/rebalance' },
};

export default function RebalancePage() {
  return <ProtocolApp view="rebalance" />;
}
