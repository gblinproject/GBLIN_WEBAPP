import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientContextProvider } from "@/components/ClientContextProvider";
import { Analytics } from "@vercel/analytics/next";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientContextProvider>{children}</ClientContextProvider>
        <Analytics />
      </body>
    </html>
  );
}
