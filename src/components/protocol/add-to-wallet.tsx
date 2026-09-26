'use client';

/**
 * "Add GBLIN to your wallet": asks the wallet to track the token with its logo (EIP-747,
 * `wallet_watchAsset`). No transaction and no signature: the wallet shows its own confirmation.
 *
 * The provider is the wallet the visitor connected on this site when there is one; otherwise the
 * first wallet announced through EIP-6963 (MetaMask preferred), then the legacy `window.ethereum`.
 */

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Check, Wallet } from 'lucide-react';
import { CONTRACT_ADDRESS } from './protocol-data';

type Eip1193 = { request: (args: { method: string; params?: unknown }) => Promise<unknown> };
type Announced = { info: { rdns: string }; provider: Eip1193 };

const TOKEN_IMAGE = 'https://gblin.digital/logo-400.png';

async function discoverProvider(): Promise<Eip1193 | null> {
  if (typeof window === 'undefined') return null;
  const found: Announced[] = [];
  const onAnnounce = (e: Event) => found.push((e as CustomEvent<Announced>).detail);
  window.addEventListener('eip6963:announceProvider', onAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  await new Promise((r) => setTimeout(r, 300));
  window.removeEventListener('eip6963:announceProvider', onAnnounce);
  const preferred = found.find((p) => p.info.rdns === 'io.metamask') ?? found[0];
  if (preferred) return preferred.provider;
  return ((window as unknown as { ethereum?: Eip1193 }).ethereum) ?? null;
}

export function AddToWallet({ t, className = 'g-chip' }: { t: (key: string) => string; className?: string }) {
  const { connector, isConnected } = useAccount();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'none' | 'error'>('idle');

  const add = async () => {
    setState('busy');
    try {
      let provider: Eip1193 | null = null;
      if (isConnected && connector?.getProvider) {
        provider = ((await connector.getProvider().catch(() => null)) as Eip1193 | null) ?? null;
      }
      if (!provider) provider = await discoverProvider();
      if (!provider) {
        setState('none');
        return;
      }
      const added = await provider.request({
        method: 'wallet_watchAsset',
        params: { type: 'ERC20', options: { address: CONTRACT_ADDRESS, symbol: 'GBLIN', decimals: 18, image: TOKEN_IMAGE } },
      });
      setState(added === false ? 'idle' : 'done');
    } catch (err) {
      const code = (err as { code?: number })?.code;
      setState(code === 4001 ? 'idle' : 'error');
    }
  };

  const label =
    state === 'done' ? t('site.addToWalletDone')
      : state === 'none' ? t('site.addToWalletNone')
        : state === 'error' ? t('site.addToWalletError')
          : t('site.addToWallet');

  return (
    <button className={className} disabled={state === 'busy'} onClick={add} type="button">
      {state === 'done' ? <Check className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
