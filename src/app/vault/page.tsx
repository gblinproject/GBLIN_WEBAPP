import type { Metadata } from 'next';
import { ProtocolApp } from '@/components/protocol/protocol-app';

export const metadata: Metadata = {
  title: 'The Vault — Smart Contract Architecture & On-Chain Reserves',
  description:
    'Inspect the GBLIN vault: 667 lines of audited Solidity, immutable, no admin key. View live reserves, stability fund, dynamic reserve, and yield distribution mechanism on Base Mainnet.',
  alternates: { canonical: 'https://gblin.digital/vault' },
};

export default function VaultPage() {
  return <ProtocolApp view="vault" />;
}
