"use client";

import { http, createConfig } from "wagmi";
import { arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains";
import { coinbaseWallet, metaMask } from "wagmi/connectors";

// SINGLE shared wallet stack for the whole account page.
// The LI.FI widget auto-detects the surrounding WagmiProvider and REUSES this
// connection (EthereumWidgetProvider: inEthereumContext -> external context),
// so buy (LI.FI), sell/send/migrate (direct wagmi writes) and the header
// connect button all share ONE wallet session. thirdweb is no longer used
// on this page.
export const wagmiConfig = createConfig({
  chains: [base, mainnet, arbitrum, optimism, polygon],
  connectors: [
    metaMask(),
    coinbaseWallet({ appName: "GBLIN Protocol" }),
  ],
  // Same reliable endpoints used by the LI.FI widget sdkConfig.rpcUrls.
  transports: {
    [base.id]: http("https://mainnet.base.org"),
    [mainnet.id]: http("https://cloudflare-eth.com"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
    [optimism.id]: http("https://mainnet.optimism.io"),
    [polygon.id]: http("https://polygon-rpc.com"),
  },
});
