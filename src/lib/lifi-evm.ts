"use client";

import { EthereumProvider } from "@lifi/widget-provider-ethereum";
import { EthereumProvider as SdkEthereumProvider } from "@lifi/sdk-provider-ethereum";

// EIP-5792 KILL SWITCH. With MetaMask, the LI.FI SDK detected atomic-batch
// support, submitted via wallet_sendCalls, then wallet_getCallsStatus failed
// with "No matching bundle found" — the tx CONFIRMED on-chain while the widget
// showed a failure. Wrapping the wallet client so EIP-5792 probes throw forces
// the "standard" strategy: classic sequential transactions with real hashes.
const BLOCKED_5792 = new Set([
  "wallet_getCapabilities",
  "wallet_sendCalls",
  "wallet_getCallsStatus",
  "wallet_showCallsStatus",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withoutBatching<T extends { request: (...a: any[]) => any }>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "request") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (args: any, ...rest: any[]) => {
          if (BLOCKED_5792.has(args?.method)) {
            return Promise.reject(new Error("EIP-5792 disabled by integrator"));
          }
          return target.request(args, ...rest);
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/**
 * SINGLE shared LI.FI EVM provider component. Used BOTH:
 *  - at page level (inside WalletManagementProviders) — powers the official
 *    LI.FI wallet menu (all EIP-6963 wallets, Coinbase, MetaMask) and creates
 *    the external EVM context;
 *  - by the LI.FI widget, which detects that external context and reuses the
 *    SAME connection (one wallet session for the whole page).
 * The custom sdkProvider applies the EIP-5792 kill switch to every wallet
 * client the LI.FI execution layer obtains.
 */
export const lifiEvmProvider = EthereumProvider({
  metaMask: true,
  coinbase: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdkProvider: (deps: any) =>
    SdkEthereumProvider({
      ...deps,
      getWalletClient: async () => withoutBatching(await deps.getWalletClient()),
      switchChain: async (chainId: number) => {
        const client = await deps.switchChain?.(chainId);
        return client ? withoutBatching(client) : client;
      },
    }),
});
