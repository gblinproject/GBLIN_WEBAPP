"use client";

import React from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmi';

// One shared wallet stack for the whole app: the same wagmi config singleton
// the /account page and the LI.FI widget already use, so every page shares a
// single wallet session (thirdweb removed).
const queryClient = new QueryClient();

export function ContextProvider({ children, cookies }: { children: React.ReactNode; cookies?: string | null }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
