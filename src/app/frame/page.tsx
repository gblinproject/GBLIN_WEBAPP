import type { Metadata } from "next";

const SITE_URL = "https://gblin.digital";
const FRAME_IMAGE = `${SITE_URL}/api/frame/image`;
const SPLASH_IMAGE =
  "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png";
const DASHBOARD_URL = "https://dune.com/gblin/dashboard";

// Farcaster Frame v2 / Mini App embed.
// Modern Warpcast renders this as an interactive embed with a launch button.
// Reference: https://miniapps.farcaster.xyz/docs/specification#frame-embed
const frameEmbed = {
  version: "next",
  imageUrl: FRAME_IMAGE,
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

export const metadata: Metadata = {
  title: "GBLIN — Autonomous Basket on Base",
  description:
    "Live on-chain stats for GBLIN. Autonomous rebalances, transparent NAV, no admin keys.",
  openGraph: {
    title: "GBLIN — Autonomous Basket on Base",
    description: "Autonomous on-chain basket. cbBTC + WETH + USDC. No admin keys.",
    images: [{ url: FRAME_IMAGE, width: 1200, height: 630 }],
    url: `${SITE_URL}/frame`,
  },
  other: {
    // Frame v2 / Mini App embed (modern Warpcast)
    "fc:frame": JSON.stringify(frameEmbed),
    // Mirror under fc:miniapp per the Mini App spec
    "fc:miniapp": JSON.stringify(frameEmbed),
  },
};

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
        src={FRAME_IMAGE}
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
