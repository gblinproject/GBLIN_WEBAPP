import type { Metadata } from "next";
import FrameHook from "./FrameHook";

const SITE_URL = "https://gblin.digital";
const FRAME_IMAGE_BASE = `${SITE_URL}/api/frame/image`;
const SPLASH_IMAGE = `${SITE_URL}/LOGO_GBLIN.png`;

type FramePageProps = {
  searchParams: Promise<{
    holders?: string;
    saved?: string;
    crash?: string;
  }>;
};

function buildFrameImageUrl(params: {
  holders?: string;
  saved?: string;
  crash?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.holders) qs.set("holders", params.holders);
  if (params.saved) qs.set("saved", params.saved);
  if (params.crash) qs.set("crash", params.crash);
  const tail = qs.toString();
  return tail ? `${FRAME_IMAGE_BASE}?${tail}` : FRAME_IMAGE_BASE;
}

export async function generateMetadata({
  searchParams,
}: FramePageProps): Promise<Metadata> {
  const params = await searchParams;
  const frameImage = buildFrameImageUrl(params);

  const BUTTON_TITLE = "Open GBLIN";

  const miniappEmbed = {
    version: "1",
    imageUrl: frameImage,
    button: {
      title: BUTTON_TITLE,
      action: {
        type: "launch_miniapp",
        name: "GBLIN",
        url: `${SITE_URL}/frame`,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#0a0b14",
      },
    },
  };

  const frameEmbed = {
    version: "1",
    imageUrl: frameImage,
    button: {
      title: BUTTON_TITLE,
      action: {
        type: "launch_frame",
        name: "GBLIN",
        url: `${SITE_URL}/frame`,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#0a0b14",
      },
    },
  };

  return {
    title: "GBLIN — cbBTC, WETH and USDC in one token",
    description:
      "cbBTC, WETH and USDC in one token on Base. Mint with ETH from the vault contract: 0.10% mint fee plus gas. GBLIN is volatile.",
    openGraph: {
      title: "GBLIN — cbBTC, WETH and USDC in one token",
      description:
        "cbBTC, WETH and USDC in one token on Base. Mint with ETH from the vault contract: 0.10% mint fee plus gas. GBLIN is volatile.",
      images: [{ url: frameImage, width: 1200, height: 800 }],
      url: `${SITE_URL}/frame`,
    },
    other: {
      "fc:miniapp": JSON.stringify(miniappEmbed),
      "fc:frame": JSON.stringify(frameEmbed),
    },
  };
}

export default function FramePage() {
  return <FrameHook />;
}
