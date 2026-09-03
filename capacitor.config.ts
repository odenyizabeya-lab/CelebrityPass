import type { CapacitorConfig } from "@capacitor/cli";

/**
 * CelebrityPass — Capacitor configuration.
 *
 * The web application is a server-rendered Next.js app (Prisma + SQLite on the
 * backend), so the Android app is a secure WebView shell that loads the hosted
 * production site rather than a static bundle. Set NEXT_PUBLIC_APP_URL to your
 * production HTTPS domain before building the release (see .env.example).
 */
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://celebritypass.app").replace(/\/$/, "");

const config: CapacitorConfig = {
  appId: "com.celebritypass.app",
  appName: "CelebrityPass",
  webDir: "out",
  server: {
    url: appUrl,
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [appUrl.replace("https://", ""), appUrl.replace("http://", "")],
  },
  android: {
    backgroundColor: "#1e1b2e",
    allowMixedContent: false,
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;