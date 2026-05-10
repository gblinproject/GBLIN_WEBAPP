import type { Metadata } from "next";
import CrashShieldGame from "./CrashShieldGame";

const SITE_URL = "https://gblin.digital";
const SPLASH_IMAGE =
  "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png";

type GamePageProps = {
  searchParams: Promise<{
    crash?: string;
    saved?: string;
    direct?: string;
    gblin?: string;
  }>;
};

export async function generateMetadata({ searchParams }: GamePageProps): Promise<Metadata> {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.crash) qs.set("crash", params.crash);
  if (params.saved) qs.set("saved", params.saved);
  if (params.direct) qs.set("direct", params.direct);
  if (params.gblin) qs.set("gblin", params.gblin);
  const imageQs = qs.toString();
  const frameImage = `${SITE_URL}/api/game/image${imageQs ? `?${imageQs}` : ""}`;
  const gameUrl = `${SITE_URL}/game${imageQs ? `?${imageQs}` : ""}`;

  // Mini App embed pointing back at /game so re-shares deep-link to the same result.
  // Spec: https://miniapps.farcaster.xyz/docs/guides/sharing
  const miniappEmbed = {
    version: "1",
    imageUrl: frameImage,
    button: {
      title: "Run your crash test",
      action: {
        type: "launch_miniapp",
        name: "GBLIN — Crash Shield",
        url: gameUrl,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#050505",
      },
    },
  };

  // Legacy fc:frame fallback for older Warpcast clients.
  const frameEmbed = {
    version: "1",
    imageUrl: frameImage,
    button: {
      title: "Run your crash test",
      action: {
        type: "launch_frame",
        name: "GBLIN — Crash Shield",
        url: gameUrl,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#050505",
      },
    },
  };

  const title = params.saved
    ? `GBLIN saved $${params.saved} during the ${params.crash ?? "crash"} backtest`
    : "GBLIN Crash Shield — Survive the Crash";

  const description = params.saved
    ? `A direct crypto portfolio lost ${params.direct ?? "?"}% while the GBLIN basket lost ${params.gblin ?? "?"}%.`
    : "Pick a historical crash. See how the GBLIN autonomous Crash Shield would have protected your portfolio. Built on Base.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: frameImage, width: 1200, height: 800 }],
      url: gameUrl,
    },
    other: {
      "fc:miniapp": JSON.stringify(miniappEmbed),
      "fc:frame": JSON.stringify(frameEmbed),
    },
  };
}

export default function GamePage() {
  return <CrashShieldGame />;
}
