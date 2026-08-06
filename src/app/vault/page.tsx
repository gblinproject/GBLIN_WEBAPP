import type { Metadata } from 'next';
import { ProtocolApp } from '@/components/protocol/protocol-app';

export const metadata: Metadata = {
  title: 'The Vault — contract and on-chain reserves',
  description:
    'Inspect the GBLIN vault: open-source Solidity verified on Basescan, governed by a 48h public timelock. Live reserves and stability fund on Base mainnet.',
  alternates: { canonical: 'https://gblin.digital/vault' },
};

export default function VaultPage() {
  return <ProtocolApp view="vault" />;
}
