import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { ClientContextProvider } from "@/components/ClientContextProvider";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = "https://gblin.digital";
const OG_IMAGE =
  "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png";
const SITE_DESCRIPTION =
  "GBLIN is a non-speculative on-chain index on Base Network. 45% cbBTC + 45% WETH + 10% USDC. Algorithmic rebalancing, transparent NAV, no team allocation, no VC, no presale. Wealth preservation, not speculation.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "GBLIN — Wealth Preservation Protocol on Base | The Golden Vault",
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
    title: "GBLIN — Wealth Preservation Protocol on Base",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "GBLIN — The Golden Vault on Base",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GBLIN — Wealth Preservation Protocol on Base",
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
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
        "https://basescan.org/address/0x38DcDB3A381677239BBc652aed9811F2f8496345",
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const cookies = headerStore.get("cookie");

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body className={inter.className}>
        <ClientContextProvider cookies={cookies}>{children}</ClientContextProvider>
        <PWAInstallPrompt />
        <Analytics />
      </body>
    </html>
  );
}
