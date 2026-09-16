import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Proxying of external knowledge-panel images (Wikipedia leads, Deezer album
 * covers, movie posters) through our own origin. Panel images are stored as
 * hotlinked external URLs, and adblockers / privacy browsers / strict ISP
 * filters block cross-origin image loads — which is exactly the "black image"
 * symptom on profile pages. Serving them via /images/ext/... keeps them on
 * celebritypass.app, exactly like the profile photos already are.
 *
 * The route refuses anything that isn't (a) signed with our cookie secret and
 * (b) one of the allowlisted image hosts, so /images/ext can never become an
 * open proxy.
 */

const ALLOWED_IMAGE_HOSTS = new Set([
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "en.wikipedia.org",
  "cdn-images.dzcdn.net",
  "e-cdns-images.dzcdn.net",
]);

export function imageHostAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return ALLOWED_IMAGE_HOSTS.has(host);
  } catch {
    return false;
  }
}

function signPath(path: string): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) return "";
  return createHmac("sha256", secret).update(path).digest("hex");
}

/** URL-safe wrapper around the proxied path + signature. */
export function panelImageSrc(url: string): string | null {
  if (!imageHostAllowed(url)) return null;
  const path = `/images/ext?u=${encodeURIComponent(url)}`;
  const sig = signPath(path);
  if (!sig) return null;
  return `${path}&s=${sig}`;
}

export function verifyPanelImageSig(search: URLSearchParams): boolean {
  const u = search.get("u");
  if (!u || !imageHostAllowed(u)) return false;
  const s = search.get("s");
  if (!s || !process.env.COOKIE_SECRET) return false;
  const path = `/images/ext?u=${encodeURIComponent(u)}`;
  const expected = signPath(path);
  if (!expected) return false;
  const a = Buffer.from(s, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}