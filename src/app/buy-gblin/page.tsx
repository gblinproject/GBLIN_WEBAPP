import type { Metadata } from 'next';
import { ProtocolApp } from '@/components/protocol/protocol-app';

export const metadata: Metadata = {
  title: 'Buy GBLIN — Mint The Golden Vault Index on Base',
  description:
    'Mint GBLIN by depositing ETH on Base. Your ETH is automatically converted into a 45% cbBTC + 45% WETH + 10% USDC basket. Audited smart contract, no team allocation, no presale.',
  alternates: { canonical: 'https://gblin.digital/buy-gblin' },
};

export default function BuyGblinPage() {
  return <ProtocolApp view="buy" />;
}
