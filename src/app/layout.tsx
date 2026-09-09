import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LanguageProvider from "@/lib/i18n/language-context";
import {
  localeDir,
  parseAcceptLanguage,
  resolveInitialLocale,
} from "@/lib/i18n/locales";
import { appUrl } from "@/lib/utils";

const BASE_URL = appUrl();

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "CelebrityPass — Multi-Celebrity Fan Card & Events Community",
    template: "%s | CelebrityPass",
  },
  description:
    "CelebrityPass is an entertainment platform for legitimate celebrity fan cards, event tickets, concerts, shows, VIP experiences, meet-and-greet experiences, and other legitimate ticketed events.",
  applicationName: "CelebrityPass",
  alternates: { canonical: BASE_URL },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CelebrityPass",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const h = await headers();
  const serverCountry =
    h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? null;
  const initialLocale = resolveInitialLocale(
    null,
    serverCountry,
    parseAcceptLanguage(h.get("accept-language")),
  );

  return (
    <html lang={initialLocale} dir={localeDir(initialLocale)} className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-aurora">
        <LanguageProvider initialLocale={initialLocale} serverCountry={serverCountry}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}