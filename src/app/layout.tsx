import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientContextProvider } from "@/components/ClientContextProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GBLIN (The Golden Vault)",
  description: "Protocollo di preservazione della ricchezza su Base Network.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className={inter.className}>
        <ClientContextProvider>{children}</ClientContextProvider>
      </body>
    </html>
  );
}
