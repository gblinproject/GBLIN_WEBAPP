import type { Metadata } from "next";

const SITE_URL = "https://gblin.digital";
const FRAME_IMAGE = `${SITE_URL}/api/frame/image`;
const DASHBOARD_URL = "https://dune.com/gblin/dashboard";

// Farcaster Frame v1 meta tags. Compatible with Warpcast and all major clients.
// Buttons use the "link" action so no backend POST handler is needed.
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
    // Frame v1
    "fc:frame": "vNext",
    "fc:frame:image": FRAME_IMAGE,
    "fc:frame:image:aspect_ratio": "1.91:1",

    "fc:frame:button:1": "Buy GBLIN",
    "fc:frame:button:1:action": "link",
    "fc:frame:button:1:target": `${SITE_URL}/buy-gblin`,

    "fc:frame:button:2": "Trigger Rebalance",
    "fc:frame:button:2:action": "link",
    "fc:frame:button:2:target": `${SITE_URL}/rebalance`,

    "fc:frame:button:3": "Live Dashboard",
    "fc:frame:button:3:action": "link",
    "fc:frame:button:3:target": DASHBOARD_URL,

    "fc:frame:button:4": "Open App",
    "fc:frame:button:4:action": "link",
    "fc:frame:button:4:target": SITE_URL,
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
