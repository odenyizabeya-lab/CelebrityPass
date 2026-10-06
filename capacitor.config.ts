import type { CapacitorConfig } from "@capacitor/cli";
// Relative (not `@/`) so the Capacitor CLI's own TypeScript loader can resolve it.
// `routes.ts` has no imports of its own, so this stays dependency-free.
import { NATIVE_UA_MARKER } from "./src/lib/routes";

/**
 * CelebrityPass — Capacitor configuration.
 *
 * The web application is a server-rendered Next.js app (Prisma on the
 * backend), so the Android app is a secure WebView shell that loads the hosted
 * production site rather than a static bundle. Set NEXT_PUBLIC_APP_URL to your
 * production HTTPS domain before building the release (see .env.example).
 */
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://celebritypass.app").replace(/\/$/, "");

const config: CapacitorConfig = {
  appId: "com.kcoai.app",
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
    /**
     * Tag the WebView's user agent so the server can tell app traffic from
     * browsers. `isNativeUserAgent()` in `src/lib/routes.ts` keys off this exact
     * marker to apply the stricter in-app route policy (no public marketing
     * fallback, no "continue without an account"), while the web build keeps its
     * normal public behaviour for SEO and direct links.
     */
    appendUserAgent: NATIVE_UA_MARKER,
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;