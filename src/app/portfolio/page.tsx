import type { Metadata } from "next";
import PortfolioCheck from "./PortfolioCheck";

const SITE_URL = "https://gblin.digital";
const SPLASH_IMAGE = "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png";

type Props = {
  searchParams: Promise<{ you?: string; gblin?: string; crash?: string; u?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = await searchParams;
  const qs = new URLSearchParams();
  if (p.you) qs.set("you", p.you);
  if (p.gblin) qs.set("gblin", p.gblin);
  if (p.crash) qs.set("crash", p.crash);
  if (p.u) qs.set("u", p.u);
  const tail = qs.toString();
  const image = `${SITE_URL}/api/share${tail ? `?${tail}` : ""}`;
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

  const title = p.you
    ? `This portfolio would have crashed -${p.you}% — GBLIN -${p.gblin ?? "?"}%`
    : "GBLIN — Wallet Stress Test";

  return {
    title,
    description: "See how far your real BTC/ETH portfolio would have crashed vs the GBLIN basket. On Base.",
    openGraph: {
      title,
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
