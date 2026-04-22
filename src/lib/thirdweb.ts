import { createThirdwebClient } from "thirdweb";
import { base } from "thirdweb/chains";
import { createWallet } from "thirdweb/wallets";

// Thirdweb Client ID - provided by user
const CLIENT_ID = "1afe221d496acd6cddaa4fc7127898b6";

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
