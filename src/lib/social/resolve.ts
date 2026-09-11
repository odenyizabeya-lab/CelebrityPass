/**
 * The four permanent, verified platform links — the source of truth for every
 * celebrity profile.
 *
 * Contract (the same rule the scanner and admin form already state):
 *   - facebook / instagram / tiktok: a link is shown ONLY when it is the
 *     celebrity's verified OFFICIAL account. Anything unverifiable, guessed,
 *     plain-homepage, or placeholder-shaped becomes null → the platform is
 *     simply not shown (nothing is better than a broken/fake link).
 *   - google: a link always exists. Google is the one platform resolvable
 *     deterministically for any named person — the official-result Google
 *     search page for their exact name, the exact fallback the scanner is
 *     instructed to produce when no confirmed Google presence is found.
 */

export type SocialPlatform = "facebook" | "instagram" | "tiktok" | "google";

export type SocialLinkValues = {
  facebook?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  google?: string | null;
};

export type CanonicalSocialLinks = {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  google?: string;
};

const PLATFORM_HOSTS: Record<Exclude<SocialPlatform, "google">, string> = {
  facebook: "facebook.com",
  instagram: "instagram.com",
  tiktok: "tiktok.com",
};

/** Google's official-result page for a person's exact name. Always relevant. */
export function defaultGoogleUrl(name: string): string {
  const q = name.trim();
  if (!q) return "";
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function isDomain(hostname: string, base: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return h === base || h.endsWith(`.${base}`);
}

/**
 * Returns the canonical, safe URL for a platform value, or null when the value
 * is empty, malformed, or a non-official link (search page, bare homepage,
 * placeholder handle, tracker, etc.). Never trusts a raw string.
 */
export function normalizeSocialUrl(platform: SocialPlatform, raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  if (platform === "google") {
    // Only an actual Google destination is acceptable (search page or a Google
    // presence/knowledge result). Anything else → fall back to the search page.
    return isDomain(url.hostname, "google.com") && !url.hostname.includes("googleusercontent.com") ? trimmed : null;
  }

  const host = PLATFORM_HOSTS[platform];
  if (!isDomain(url.hostname, host)) return null;

  // An official profile has a real handle in the path — never a bare homepage,
  // a search/hashtag page, or a template/placeholder handle. Strip an optional
  // leading language segment (e.g. /en/handle) first.
  const path = url.pathname.replace(/^\/[a-z]{2}([-_][a-zA-Z]{2})?\/(?=[^/])/, "").replace(/\/+$/, "");
  if (!path) return null;
  if (path === "search" || path.startsWith("hashtag/") || path.startsWith("share/")) return null;
  if (/@?(undefined|null|none|noname|user|profile)\b/i.test(path)) return null;
  if (/%7[bB]|%7[dD]|\{[^}]*\}/.test(raw!)) return null;

  return trimmed;
}

/**
 * The full, canonical set for a celebrity name: every platform normalized and
 * Google guaranteed. Facebook/Instagram/TikTok are undefined when unverified —
 * callers simply don't render those platforms.
 */
export function canonicalSocialLinks(name: string, existing?: SocialLinkValues | null): CanonicalSocialLinks {
  const google = normalizeSocialUrl("google", existing?.google) ?? defaultGoogleUrl(name);
  return {
    facebook: normalizeSocialUrl("facebook", existing?.facebook) ?? undefined,
    instagram: normalizeSocialUrl("instagram", existing?.instagram) ?? undefined,
    tiktok: normalizeSocialUrl("tiktok", existing?.tiktok) ?? undefined,
    google: google || undefined,
  };
}