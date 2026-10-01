import type { Metadata } from "next";
import ParkEarnings from "./ParkEarnings";

const SITE_URL = "https://gblin.digital";
const IMAGE = `${SITE_URL}/api/frame/og`;
const SPLASH_IMAGE = `${SITE_URL}/LOGO_GBLIN.png`;
const TITLE = "GBLIN — Park your earnings";
const DESCRIPTION =
  "Keep what you spend liquid, see what the rest would do in one token holding cbBTC, WETH and USDC on Base: amount received at net asset value, every fee, and what it costs to get out today.";

const embed = (type: "launch_miniapp" | "launch_frame") => ({
  version: "1",
  imageUrl: IMAGE,
  button: {
    title: "Park your earnings",
    action: {
      type,
      name: "GBLIN",
      url: `${SITE_URL}/frame/park`,
      splashImageUrl: SPLASH_IMAGE,
      splashBackgroundColor: "#0a0b14",
    },
  },
});

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/frame/park` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/frame/park`, images: [{ url: IMAGE, width: 1200, height: 800 }] },
  other: {
    "fc:miniapp": JSON.stringify(embed("launch_miniapp")),
    "fc:frame": JSON.stringify(embed("launch_frame")),
  },
};

export default function ParkPage() {
  return <ParkEarnings />;
}
