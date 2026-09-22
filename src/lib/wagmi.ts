"use client";

import { fallback, http, createConfig } from "wagmi";
import { arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains";
import { createDefaultWagmiConfig } from "@lifi/widget-provider-ethereum";
import { RPC_URL } from "@/components/protocol/protocol-data";

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
  // No MetaMask SDK connector. With the extension installed, the SDK and the extension both appear as
  // "MetaMask", and the SDK keeps a session of its own: writes then went out for an account other than
  // the one selected in the extension ("Different account selected", gas estimated on an empty
  // account). The extension is found through EIP-6963 like every other installed wallet, and MetaMask
  // Mobile connects through WalletConnect. A session left over from the SDK fails to reconnect and the
  // visitor connects again, this time through the extension.
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

/**
 * Reads from the browser go through several endpoints, in order, with retries.
 *
 * A single public endpoint refuses roughly one read in twenty-eight, and a refused read is
 * indistinguishable from "this wallet holds nothing": panels that fall back to an empty list
 * then state something they never measured. The first entry is the one the rest of the app
 * already uses; the public endpoints are there for when it cannot be reached.
 */
const BASE_ENDPOINTS = [
  // The same endpoint the rest of the app already reads from, so wallet reads and page reads
  // cannot disagree about what is on chain.
  RPC_URL,
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
  "https://1rpc.io/base",
].filter((url, i, all) => all.indexOf(url) === i);
const baseTransport = fallback(
  BASE_ENDPOINTS.map((url) => http(url, { retryCount: 2, retryDelay: 400, timeout: 12_000 })),
  // Keep the declared order: the first endpoint is the one with a key, when there is one.
  { rank: false },
);

export const wagmiConfig = createConfig({
  chains: [base, mainnet, arbitrum, optimism, polygon],
  connectors: lifiConnectors,
  // Same reliable endpoints used by the LI.FI widget sdkConfig.rpcUrls.
  transports: {
    [base.id]: baseTransport,
    [mainnet.id]: http("https://cloudflare-eth.com"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
    [optimism.id]: http("https://mainnet.optimism.io"),
    [polygon.id]: http("https://polygon-rpc.com"),
  },
});
