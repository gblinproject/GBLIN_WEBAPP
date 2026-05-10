import type { Metadata } from "next";

const SITE_URL = "https://gblin.digital";
const FRAME_IMAGE_BASE = `${SITE_URL}/api/frame/image`;
const SPLASH_IMAGE =
  "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png";
const DASHBOARD_URL = "https://dune.com/gblin/dashboard";
const GAME_URL = `${SITE_URL}/game`;

type FramePageProps = {
  searchParams: Promise<{
    holders?: string;
    saved?: string;
    crash?: string;
  }>;
};

// Build the OG image URL, optionally personalised via query params for shared casts.
// Spec: https://miniapps.farcaster.xyz/docs/guides/sharing#dynamic-embed-images
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

export async function generateMetadata({ searchParams }: FramePageProps): Promise<Metadata> {
  const params = await searchParams;
  const frameImage = buildFrameImageUrl(params);

  // Mini App embed — opens the dApp. Spec allows exactly one button.
  const miniappEmbed = {
    version: "1",
    imageUrl: frameImage,
    button: {
      title: "Open GBLIN",
      action: {
        type: "launch_miniapp",
        name: "GBLIN",
        url: SITE_URL,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#050505",
      },
    },
  };

  // Legacy fc:frame embed for older Warpcast clients.
  const frameEmbed = {
    version: "1",
    imageUrl: frameImage,
    button: {
      title: "Open GBLIN",
      action: {
        type: "launch_frame",
        name: "GBLIN",
        url: SITE_URL,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#050505",
      },
    },
  };

  return {
    title: "GBLIN — Autonomous Basket on Base",
    description:
      "Live on-chain stats for GBLIN. Autonomous rebalances, transparent NAV, no admin keys.",
    openGraph: {
      title: "GBLIN — Autonomous Basket on Base",
      description: "Autonomous on-chain basket. cbBTC + WETH + USDC. No admin keys.",
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
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#050505",
        color: "#f5d77a",
        padding: "32px",
        textAlign: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 48, margin: 0, letterSpacing: -1 }}>GBLIN</h1>
      <p style={{ color: "#9a8a5c", marginTop: 12, maxWidth: 560 }}>
        This page is a Farcaster Frame entry point. Cast its URL on Warpcast to embed
        live on-chain GBLIN stats with action buttons.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap", justifyContent: "center" }}>
        <a
          href="/buy-gblin"
          style={{
            padding: "12px 22px",
            background: "#f5d77a",
            color: "#050505",
            borderRadius: 999,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Buy GBLIN
        </a>
        <a
          href={GAME_URL}
          style={{
            padding: "12px 22px",
            background: "transparent",
            color: "#f5d77a",
            border: "1px solid #f5d77a",
            borderRadius: 999,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Play Crash Shield
        </a>
        <a
          href="/rebalance"
          style={{
            padding: "12px 22px",
            background: "transparent",
            color: "#f5d77a",
            border: "1px solid #f5d77a",
            borderRadius: 999,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Trigger Rebalance
        </a>
        <a
          href={DASHBOARD_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "12px 22px",
            background: "transparent",
            color: "#f5d77a",
            border: "1px solid #f5d77a",
            borderRadius: 999,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Live Dashboard
        </a>
      </div>
      <img
        src={FRAME_IMAGE_BASE}
        alt="GBLIN live stats"
        style={{
          marginTop: 40,
          width: "100%",
          maxWidth: 720,
          borderRadius: 18,
          border: "1px solid rgba(245,215,122,0.25)",
        }}
      />
    </main>
  );
}
