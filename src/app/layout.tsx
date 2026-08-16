import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { ClientContextProvider } from "@/components/ClientContextProvider";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import FarcasterMiniAppReady from "@/components/FarcasterMiniAppReady";
import FarcasterInstallBanner from "@/components/FarcasterInstallBanner";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = "https://gblin.digital";
const OG_IMAGE =
  "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png";
// Wide 1200x630 social-share banner (avoids X/OG cropping the square logo).
// Lightweight JPG + fresh filename so X/Twitterbot fetches it reliably (no stale cache).
const OG_BANNER = `${SITE_URL}/og-gblin-v2.jpg`;
const SITE_DESCRIPTION =
  "GBLIN Protocol: one token holding cbBTC, WETH and USDC on Base, built for AI agents and treasuries. Mint and redeem directly from the contract at NAV: same price at any size, 0.10% once, no management fee.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "GBLIN Protocol — BTC + ETH + USDC treasury token on Base",
    template: "%s | GBLIN",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "GBLIN",
    "Base Network",
    "DeFi index",
    "wealth preservation",
    "on-chain index",
    "cbBTC",
    "WETH",
    "USDC",
    "crypto basket",
    "non-speculative crypto",
    "The Golden Vault",
    "Base mainnet",
    "Uniswap V3",
    "MEV rebalance",
  ],
  authors: [{ name: "GBLIN Protocol" }],
  creator: "GBLIN Protocol",
  publisher: "GBLIN Protocol",
  manifest: "/manifest.json",
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png",
    shortcut: "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png",
    apple: "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GBLIN Protocol",
  },
  openGraph: {
    type: "website",
    siteName: "GBLIN",
    title: "GBLIN Protocol — BTC + ETH + USDC treasury token on Base",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    images: [
      {
        url: OG_BANNER,
        width: 1200,
        height: 630,
        alt: "GBLIN — The Golden Vault on Base",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GBLIN Protocol — BTC + ETH + USDC treasury token on Base",
    description: SITE_DESCRIPTION,
    images: [OG_BANNER],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  other: {
    // Base / Talent Protocol ownership verification
    "talentapp:project_verification":
      "cfe9f12693146835725d6e4bebc507e025969baf4fb1dcd2ba8f2a8206c76434e39aeddfe0470a97f98cabb9a7713b38fda0ed6830af7213ff0726178005a9f2",
    // Base App Registry verification
    "base:app_id": "6a16deb1f4a52373ee3e7762",
  },
};

// JSON-LD structured data — helps Google understand GBLIN as a software product
// and surfaces rich results (knowledge panel, sitelinks).
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: "GBLIN Protocol",
      url: SITE_URL,
      logo: OG_IMAGE,
      description: SITE_DESCRIPTION,
      sameAs: [
        "https://basescan.org/address/0x36C81d7E1966310F305eA637e761Cf77F90852f0",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: "GBLIN — The Golden Vault",
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: "GBLIN Protocol",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web (Base Network)",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "ETH",
      },
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No headers()/cookies() here: reading them forced EVERY page to render
  // dynamically on each request (a paid Fluid function invocation per view).
  // The cookie was only consumed by the old thirdweb provider, now removed —
  // without it, pages prerender as static and the CDN serves them for free.
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content="6a16deb1f4a52373ee3e7762" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body className={inter.className}>
        <ClientContextProvider>{children}</ClientContextProvider>
        <PWAInstallPrompt />
        <FarcasterMiniAppReady />
        <FarcasterInstallBanner />
        <Analytics />
      </body>
    </html>
  );
}
