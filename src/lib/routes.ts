/**
 * The single source of truth for which CelebrityPass routes are public and
 * which ones belong to the signed-in application.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Route gating used to live inline in `src/proxy.ts` only, which meant the
 * request-level gate and the page-level gates could (and did) drift apart:
 * the proxy allowed `/`, and `/` happily rendered the whole personalised home
 * app (bottom nav, celebrity rails, infinite feed) to anonymous visitors.
 * Because `WelcomeScreen` is a *client* component mounted on top of that
 * already-rendered markup, a brand new user saw the internal app for as long
 * as the JS bundle took to hydrate — the "protected page flashes before login"
 * bug.
 *
 * Now both the proxy (request time, edge) and the server components (render
 * time) ask this module, so the gate can never disagree with itself.
 *
 * This module MUST stay dependency-free and edge-runtime safe: no Prisma, no
 * `next/headers`, no Node built-ins. It is imported by `src/proxy.ts`.
 */

/**
 * Personalised / internal application surfaces. These NEVER render for an
 * anonymous visitor, on the web or in the mobile app.
 *
 * `/admin` is deliberately absent. The admin console authenticates through
 * Supabase (`src/app/admin/layout.tsx` redirects to `/admin/login`), not through
 * the fan session cookie, so applying the fan gate to it would lock out real
 * admins who are not also fans. It is covered by the `ADMIN_PREFIX` note below.
 */
export const PROTECTED_PREFIXES: readonly string[] = [
  "/dashboard",
  "/account",
  "/onboarding",
  "/chat",
  "/checkout",
  "/order",
];

/**
 * Private sub-paths that live underneath an otherwise public prefix. These are
 * login-gated on every platform.
 *
 * `/invest` stays public because it is largely editorial market content
 * (markets, news, search, learn). The two routes that read a fan's money —
 * `/invest/deposit` and `/invest/portfolio` — are listed here so the request-time
 * gate turns them away before the page even renders. Both also keep their own
 * in-page guard; the request-time gate is what stops the protected shell from
 * being served first.
 */
export const PROTECTED_SUBPATHS: readonly string[] = [
  "/invest/deposit",
  "/invest/portfolio",
];

/**
 * Routes a logged-out visitor may open on the public website. Two groups:
 *
 *  - Auth + recovery + legal, linked from the auth screens.
 *  - Marketing/SEO pages. These are indexed by Google and are intentionally
 *    reachable without an account (a shared fan card is a public verification
 *    page; buying a card is deliberately login-free).
 *
 * `/api` is here because every API route guards itself with a real session
 * check, and `/admin` because the admin console has its own Supabase gate
 * (`src/app/admin/layout.tsx`) — applying the fan gate there would be wrong.
 */
export const PUBLIC_PREFIXES: readonly string[] = [
  "/_next",
  "/api",
  "/admin",
  "/login",
  "/register",
  "/forgot-email",
  "/reset-password",
  "/verify-email",
  "/unsubscribe",
  "/legal",
  "/images",
  "/celebrities",
  "/celebrity",
  "/about",
  "/security",
  "/help",
  "/download",
  "/discovery",
  "/faq",
  "/memberships",
  "/invest",
  "/icons",
];

/**
 * Static brand/PWA assets. Matched both against the whole pathname and against
 * its last segment, because Next.js serves e.g. `/icon.svg` from the app root
 * while some are nested.
 */
export const PUBLIC_FILE_NAMES: ReadonlySet<string> = new Set([
  "favicon.ico",
  "icon.svg",
  "apple-icon.png",
  "manifest.webmanifest",
  "sw.js",
  "robots.txt",
  "sitemap.xml",
  "opengraph-image.png",
  "twitter-image.png",
  "og.png",
  "file.svg",
  "globe.svg",
  "next.svg",
  "vercel.svg",
  "window.svg",
]);

/**
 * Public on the marketing website, but login-gated inside the mobile app.
 *
 * The Android/iOS build is a closed application: once installed, its only entry
 * point is the auth flow (Welcome -> Create Account / Log In -> Onboarding ->
 * Main app). Leaving the marketing directory browsable there is what let a new
 * install drift into internal screens. On the web these stay public so search
 * engines and shared links keep working.
 *
 * `/discover` style marketing pages (`/discovery`, `/invest`, `/about`,
 * `/faq`, …) are intentionally NOT listed: they are editorial content, they
 * are linked from email receipts and tickets, and hiding them in the app would
 * break deep links without protecting anything personal.
 */
export const APP_ONLY_PROTECTED_PREFIXES: readonly string[] = [
  "/celebrities",
  "/celebrity",
];

/** Marker appended to the user agent by the native shell (see capacitor.config.ts). */
export const NATIVE_UA_MARKER = "CelebrityPassApp/";

/**
 * How a request should be treated.
 *
 * - `entry`   the auth-aware landing route: always reachable, but its content
 *             depends on the session (Welcome screen vs. the app home).
 * - `public`  safe for anonymous visitors.
 * - `protected` must be redirected to the auth screen.
 */
export type RouteDecision = "entry" | "public" | "protected";

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

function isPublicAsset(pathname: string): boolean {
  if (PUBLIC_FILE_NAMES.has(pathname)) return true;
  return PUBLIC_FILE_NAMES.has(pathname.split("/").filter(Boolean).pop() ?? "");
}

/** True for `/api/*` (each handler guards itself with a session check). */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * True when the request comes from the Capacitor mobile shell rather than a
 * normal browser. The native shell appends NATIVE_UA_MARKER; the `; wv` +
 * `Version/4.0` fallback covers builds installed before the marker existed.
 */
export function isNativeUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  if (userAgent.includes(NATIVE_UA_MARKER)) return true;
  return userAgent.includes("; wv") && userAgent.includes("Version/4.0");
}

/**
 * Classify a pathname. `isNative` switches the marketing directory between
 * "public website" and "login-gated app surface".
 */
export function classifyRoute(pathname: string, isNative = false): RouteDecision {
  // Static assets are always public and must never be redirected.
  if (isPublicAsset(pathname)) return "public";

  // The landing route is auth-aware rather than protected: anonymous visitors
  // get the Welcome screen, signed-in fans get the app home.
  if (pathname === "/") return "entry";

  if (matchesPrefix(pathname, PROTECTED_SUBPATHS)) return "protected";
  if (matchesPrefix(pathname, PROTECTED_PREFIXES)) return "protected";

  if (isNative && matchesPrefix(pathname, APP_ONLY_PROTECTED_PREFIXES)) {
    return "protected";
  }

  if (isApiPath(pathname)) return "public";
  if (matchesPrefix(pathname, PUBLIC_PREFIXES)) return "public";

  // Unknown route: fail closed. A brand new route must be classified on
  // purpose rather than silently becoming public.
  return "protected";
}

/**
 * Open-redirect-safe `?next=` handling. Only same-site absolute paths are
 * allowed; protocol-relative (`//evil.com`) and backslash tricks are rejected.
 * Returns null for anything unsafe.
 */
export function sanitizeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.includes("\\")) return null;
  if (next.includes("\n") || next.includes("\r") || next.includes("\t")) return null;
  return next;
}

/**
 * Where an anonymous visitor should be sent after authenticating. `/` is not a
 * useful destination for a brand new fan (it would bounce straight back to the
 * app home), so onboarding is the default instead.
 */
export const POST_AUTH_DEFAULT = "/onboarding/celebrities";
export const POST_LOGIN_DEFAULT = "/dashboard";

/** True when a route should never be cached as a personalised page. */
export function isPersonalised(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_PREFIXES) || matchesPrefix(pathname, PROTECTED_SUBPATHS);
}
