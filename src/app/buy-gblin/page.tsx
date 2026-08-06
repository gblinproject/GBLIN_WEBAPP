import type { Metadata } from 'next';
import { ProtocolApp } from '@/components/protocol/protocol-app';

export const metadata: Metadata = {
  title: 'Buy GBLIN — mint at NAV on Base, no pool slippage',
  description:
    'Mint GBLIN with ETH on Base and receive a cbBTC + WETH + USDC basket at NAV. Same per-token price at any size, 0.10% one-time fee, redeem any time.',
  alternates: { canonical: 'https://gblin.digital/buy-gblin' },
  robots: { index: true, follow: true },
};

export default function BuyGblinPage() {
  return <ProtocolApp view="buy" />;
}
