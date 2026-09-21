import type { Metadata } from 'next';
import { ProtocolApp } from '@/components/protocol/protocol-app';

export const metadata: Metadata = {
  title: 'Rebalance — trade with the GBLIN auction',
  description:
    'When the GBLIN basket drifts off target the vault opens a Dutch auction: anyone can trade with it at the oracle price adjusted by a premium that rises over time. Permissionless, on Base, no bounty fund — the premium is the reward.',
  alternates: { canonical: 'https://gblin.digital/rebalance' },
};

export default function RebalancePage() {
  return <ProtocolApp view="rebalance" />;
}
