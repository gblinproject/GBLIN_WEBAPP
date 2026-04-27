import { createThirdwebClient } from "thirdweb";
import { base } from "thirdweb/chains";
import { createWallet } from "thirdweb/wallets";

// Thirdweb Client ID - public by design (safe to expose in browser bundle).
// Configured via Vercel env var NEXT_PUBLIC_THIRDWEB_CLIENT_ID; fallback kept
// for local dev convenience only.
const CLIENT_ID =
  process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ??
  "1afe221d496acd6cddaa4fc7127898b6";

export const thirdwebClient = createThirdwebClient({
  clientId: CLIENT_ID,
});

export const chain = base;

// Only external wallets — no email/social login to keep the connect flow simple.
export const wallets = [
  createWallet("io.metamask"),
  createWallet("io.rabby"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
];
