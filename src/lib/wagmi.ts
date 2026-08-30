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
// GBLIN's existing Reown/WalletConnect project — recovered from the original
// pre-thirdweb AppKit setup (git f30019a, src/context/index.tsx). The env var
// overrides it if ever rotated. projectId is public by design (client-side).
const wcProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "9629f33d439505415769d9d29d7b788e";
const { connectors: lifiConnectors } = createDefaultWagmiConfig({
  // `dapp` NON e' decorativo: senza, il build stampa a ogni pagina
  // "Error initializing MetaMaskConnectMultichain: You must provide dapp url".
  // Il motivo sta nel connettore di wagmi 3.7.3 (@wagmi/connectors/metaMask.js ~244):
  //   typeof window === 'undefined' ? { name: 'wagmi' } : { name: hostname, url: href }
  // cioe' sul SERVER passa il nome ma NON l'url, e @metamask/connect-multichain lo pretende
  // ("if (!options.dapp?.url) throw"). In pre-renderizzazione window non esiste, quindi lancia.
  // Dichiarandolo qui l'errore sparisce E la finestra di conferma di MetaMask mostra il nostro
  // nome invece di "wagmi" o dell'hostname di turno — come gia' fa WalletConnect qui sotto.
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
