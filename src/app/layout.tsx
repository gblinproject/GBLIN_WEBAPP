import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { ClientContextProvider } from "@/components/ClientContextProvider";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GBLIN (The Golden Vault)",
  description: "Protocollo di preservazione della ricchezza su Base Network.",
  manifest: "/manifest.json",
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
  other: {
    // Base / Talent Protocol ownership verification
    "talentapp:project_verification":
      "cfe9f12693146835725d6e4bebc507e025969baf4fb1dcd2ba8f2a8206c76434e39aeddfe0470a97f98cabb9a7713b38fda0ed6830af7213ff0726178005a9f2",
  },
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
      <body className={inter.className}>
        <ClientContextProvider cookies={cookies}>{children}</ClientContextProvider>
        <PWAInstallPrompt />
        <Analytics />
      </body>
    </html>
  );
}
