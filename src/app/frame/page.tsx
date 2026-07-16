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

  const BUTTON_TITLE = "🛡️ Beat the crash";

  const miniappEmbed = {
    version: "1",
    imageUrl: frameImage,
    button: {
      title: BUTTON_TITLE,
      action: {
        type: "launch_miniapp",
        name: "GBLIN Crash Shield",
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
        name: "GBLIN Crash Shield",
        url: `${SITE_URL}/frame`,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#0a0b14",
      },
    },
  };

  return {
    title: "GBLIN — Crash Shield Challenge",
    description:
      "Guess how little GBLIN drops when BTC and ETH crash. Backed, self-rebalancing basket on Base. Governed by a 48h public timelock.",
    openGraph: {
      title: "GBLIN — Crash Shield Challenge",
      description:
        "Guess how little GBLIN drops when BTC and ETH crash. Autonomous on-chain basket on Base.",
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
