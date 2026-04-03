import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { ClientContextProvider } from "@/components/ClientContextProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GBLIN (The Golden Vault)",
  description: "Protocollo di preservazione della ricchezza su Base Network.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GBLIN Protocol",
  },
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
        <Analytics />
      </body>
    </html>
  );
}
