"use client";

import { http, createConfig } from "wagmi";
import { arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains";
import { createDefaultWagmiConfig } from "@lifi/widget-provider-ethereum";

// SINGLE shared wallet stack for the whole account page.
// The LI.FI widget auto-detects the surrounding WagmiProvider and REUSES this
// connection, so buy (LI.FI), sell/send/migrate (direct wagmi writes) and the
// header connect button all share ONE wallet session.
//
// Connectors come from LI.FI's OFFICIAL builder (createDefaultWagmiConfig):
// MetaMask (SDK — requires @metamask/connect-evm, pinned in package.json),
// Coinbase Wallet, Base Account (Coinbase Smart Wallet — fitting for a
// Base-native protocol), and WalletConnect (mobile wallets via QR) as soon as
// NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set (free projectId from
// https://cloud.reown.com). Installed browser extensions (Rabby, Brave, OKX,
// ...) are ADDED automatically via EIP-6963 discovery — the LI.FI menu lists
// connectors + discovered wallets, deduped by name.
//
// The fallback WalletConnect projectId below is public by design (it ships to
// the client); the environment variable overrides it if it is ever rotated.
const wcProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "9629f33d439505415769d9d29d7b788e";
const { connectors: lifiConnectors } = createDefaultWagmiConfig({
  // `dapp` is NOT decorative: without it the build logs, on every page,
  // "Error initializing MetaMaskConnectMultichain: You must provide dapp url".
  // The cause is in the wagmi MetaMask connector (@wagmi/connectors/metaMask.js):
  //   typeof window === 'undefined' ? { name: 'wagmi' } : { name: hostname, url: href }
  // i.e. on the SERVER it passes the name but NOT the url, while
  // @metamask/connect-multichain requires it ("if (!options.dapp?.url) throw").
  // During prerendering `window` does not exist, so it throws. Declaring the metadata
  // here removes the error AND makes the MetaMask confirmation dialog show the
  // application name instead of "wagmi" or the current hostname — the same metadata
  // WalletConnect is given below.
  metaMask: {
    dapp: {
      name: "GBLIN Protocol",
      url: "https://gblin.digital",
      iconUrl: "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.svg",
    },
  },
  coinbase: { appName: "GBLIN Protocol" },
  baseAccount: { appName: "GBLIN Protocol" },
  walletConnect: {
    projectId: wcProjectId,
    metadata: {
      name: "GBLIN Protocol",
      description: "Global Balanced Liquidity Index on Base",
      url: "https://gblin.digital",
      icons: ["https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.svg"],
    },
  },
});

export const wagmiConfig = createConfig({
  chains: [base, mainnet, arbitrum, optimism, polygon],
  connectors: lifiConnectors,
  // Same reliable endpoints used by the LI.FI widget sdkConfig.rpcUrls.
  transports: {
    [base.id]: http("https://mainnet.base.org"),
    [mainnet.id]: http("https://cloudflare-eth.com"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
    [optimism.id]: http("https://mainnet.optimism.io"),
    [polygon.id]: http("https://polygon-rpc.com"),
  },
});
