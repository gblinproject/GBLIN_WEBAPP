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
