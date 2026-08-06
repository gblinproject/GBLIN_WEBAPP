import type { Metadata } from 'next';
import { ProtocolApp } from '@/components/protocol/protocol-app';

export const metadata: Metadata = {
  title: 'Rebalance — earn ETH as a GBLIN keeper',
  description:
    'Anyone can call incentivizedRebalance() and earn an adaptive bounty from the stability fund when the GBLIN basket drifts off-target. Permissionless, on Base.',
  alternates: { canonical: 'https://gblin.digital/rebalance' },
};

export default function RebalancePage() {
  return <ProtocolApp view="rebalance" />;
}
