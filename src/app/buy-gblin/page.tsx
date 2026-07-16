import type { Metadata } from 'next';
import { ProtocolApp } from '@/components/protocol/protocol-app';

export const metadata: Metadata = {
  title: 'Buy GBLIN — Mint The Golden Vault Index on Base',
  description:
    'Mint GBLIN by depositing ETH on Base. Your ETH is automatically converted into a 45% cbBTC + 45% WETH + 10% USDC basket. Open-source smart contract, 48h timelock governance, no team allocation, no presale.',
  alternates: { canonical: 'https://gblin.digital/buy-gblin' },
  robots: { index: true, follow: true },
};

export default function BuyGblinPage() {
  return <ProtocolApp view="buy" />;
}
