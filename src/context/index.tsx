"use client";

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base, type AppKitNetwork } from '@reown/appkit/networks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { cookieStorage, createStorage } from '@wagmi/core';
import React from 'react';

const queryClient = new QueryClient();

const projectId = '9629f33d439505415769d9d29d7b788e';

const metadata = {
  name: 'GBLIN Protocol',
  description: 'The Golden Vault',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://gblin.vercel.app',
  icons: ['https://raw.githubusercontent.com/rubbe89/gblin-assets/main/LOGO_GBLIN.png']
};

export const networks = [base] as [AppKitNetwork, ...AppKitNetwork[]];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  networks,
  projectId
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: true
  }
});

export function ContextProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
