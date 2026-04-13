import { createThirdwebClient } from "thirdweb";
import { base } from "thirdweb/chains";
import { createWallet, inAppWallet } from "thirdweb/wallets";

// Thirdweb Client ID - provided by user
const CLIENT_ID = "1afe221d496acd6cddaa4fc7127898b6";

export const thirdwebClient = createThirdwebClient({
  clientId: CLIENT_ID,
});

export const chain = base;

export const wallets = [
  createWallet("io.metamask"),
  createWallet("io.rabby"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
  inAppWallet({
    auth: {
      options: ["google", "email", "passkey"],
    },
    metadata: {
      name: "GBLIN",
      image: {
        src: "https://raw.githubusercontent.com/rubbe89/gblin-assets/main/LOGO_GBLIN.png",
        width: 100,
        height: 100,
      },
    },
  }),
];
