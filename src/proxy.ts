import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";

const FAN_COOKIE = "fc_fan";

/**
 * Paths a logged-out visitor may open: the auth screens themselves, password
 * reset / email verification / unsubscribe links (sent by email while logged
 * out), the admin console (it has its own Supabase-auth gate), the legal pages
 * the auth screens link to, all API routes (each guards itself), and static
 * assets. Every other page — home, celebrities, celebrity profiles, chat,
 * events, checkout, onboarding — requires a valid fan session.
 */
const PUBLIC_PREFIXES = [
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
  // Public marketing/SEO pages (indexed by Google). Chat, checkout, orders,
  // onboarding, account and dashboard stay login-gated.
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
  // Public invest/market pages (market info is indexed + explorable). The
  // portfolio page and everything investment-sensitive stays login-gated via
  // the private sub-path exclusion below.
  "/invest",
  // Static brand/PWA icons (icons are public assets; only icon files live here).
  "/icons",
];

const PUBLIC_FILE_NAMES = new Set([
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

function cookieSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (secret) return secret;
  throw new Error("COOKIE_SECRET is not set.");
}

/** Verifies the HMAC signature of the fan session cookie (no DB lookup). */
function isFanSessionValid(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const secret = cookieSecret();
    const idx = token.lastIndexOf(".");
    if (idx < 0) return false;
    const payload = token.slice(0, idx);
    const sig = token.slice(idx + 1);
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_FILE_NAMES.has(pathname)) return true;
  if (PUBLIC_FILE_NAMES.has(pathname.split("/").filter(Boolean).pop() ?? "")) {
    return true;
  }
  // Private sub-paths of public prefixes must remain login-gated: ticket
  // checkout and the brokerage portfolio (holdings/orders = personal data).
  // Fan cards and the /join funnel stay PUBLIC on purpose: a card link is a
  // shareable public verification page (FAQ) and card purchase is deliberately
  // login-free (register API), so logged-out fans can still open both on any
  // device (phones included).
  if (pathname.startsWith("/invest/portfolio")) {
    return false;
  }
  if (pathname === "/") {
    return true;
  }
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isFanSessionValid(request.cookies.get(FAN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.search = new URLSearchParams({
    next: pathname + request.nextUrl.search,
  }).toString();
  return NextResponse.redirect(loginUrl);
}