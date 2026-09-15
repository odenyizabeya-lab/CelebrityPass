import type { Metadata, Viewport } from "next";
import "./globals.css";
import NativeIntegration from "@/components/NativeIntegration";
import PushBootstrap from "@/components/PushBootstrap";
import InAppNotifications from "@/components/InAppNotifications";
import LanguageProvider from "@/lib/i18n/language-context";
import { DEFAULT_LOCALE, localeDir } from "@/lib/i18n/locales";
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
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "CelebrityPass",
    title: "CelebrityPass — Official Celebrity Fan Cards & Communities",
    description:
      "Get a legitimate official fan card for your favorite celebrity and join their exclusive community. CelebrityPass.",
  },
  twitter: {
    card: "summary",
    title: "CelebrityPass — Official Celebrity Fan Cards & Communities",
    description:
      "Get a legitimate official fan card for your favorite celebrity and join their exclusive community. CelebrityPass.",
  },
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
  // Locale resolution happens on the client inside LanguageProvider (browser
  // languages + saved choice), which also rewrites <html lang>/dir after
  // hydration. Keeping this layout free of Request-time APIs (`headers()`)
  // lets public pages stay statically cached / ISR instead of forcing every
  // route dynamic. The English SSR default is corrected client-side.
  const initialLocale = DEFAULT_LOCALE;

  return (
    <html lang={initialLocale} dir={localeDir(initialLocale)} className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-aurora">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": `${BASE_URL}/#website`,
                  url: BASE_URL,
                  name: "CelebrityPass",
                  description:
                    "Official celebrity fan cards and exclusive fan communities. Legitimate tickets and experiences for A-list celebrities, athletes, musicians and creators.",
                },
                {
                  "@type": "Organization",
                  "@id": `${BASE_URL}/#organization`,
                  url: BASE_URL,
                  name: "CelebrityPass",
                  email: "support@celebritypass.app",
                },
              ],
            }),
          }}
        />
        <LanguageProvider initialLocale={initialLocale} serverCountry={null}>
          {children}
          <NativeIntegration />
          <PushBootstrap />
          <InAppNotifications />
        </LanguageProvider>
      </body>
    </html>
  );
}