import type { Metadata } from "next";
import PortfolioCheck from "./PortfolioCheck";

const SITE_URL = "https://gblin.digital";
const SPLASH_IMAGE = "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png";

export async function generateMetadata(): Promise<Metadata> {
  const image = `${SITE_URL}/api/share`;
  const BUTTON = "🩸 Stress-test my wallet";

  const miniapp = {
    version: "1",
    imageUrl: image,
    button: {
      title: BUTTON,
      action: {
        type: "launch_miniapp",
        name: "GBLIN Wallet Stress Test",
        url: `${SITE_URL}/portfolio`,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#050505",
      },
    },
  };
  const frame = { ...miniapp, button: { ...miniapp.button, action: { ...miniapp.button.action, type: "launch_frame" } } };

  return {
    title: "GBLIN — Wallet Stress Test",
    description: "See how far your real BTC/ETH portfolio would have crashed vs the GBLIN basket. On Base.",
    openGraph: {
      title: "GBLIN — Wallet Stress Test",
      description: "How hard would your wallet have crashed? Compare your holdings to the GBLIN Crash Shield.",
      images: [{ url: image, width: 1200, height: 800 }],
      url: `${SITE_URL}/portfolio`,
    },
    other: {
      "fc:miniapp": JSON.stringify(miniapp),
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default function PortfolioPage() {
  return <PortfolioCheck />;
}
