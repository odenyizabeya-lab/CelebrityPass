import crypto from "crypto";

/** Slugify a celebrity name into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Format a date string as e.g. "Jan 12, 2026". */
export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Pad a number into FC-000001 style fan numbers. */
export function fanNumberFromSeq(seq: number): string {
  return `FC-${String(seq).padStart(6, "0")}`;
}

/** Generate the next sequence number for a fan card. */
export async function nextFanSeq(): Promise<number> {
  // Uses the newest card's fan number if present, else starts at 1.
  const { prisma } = await import("./db");
  const latest = await prisma.fanCard.findFirst({
    orderBy: { fanNumber: "desc" },
    select: { fanNumber: true },
  });
  if (!latest) return 1;
  const seq = parseInt(latest.fanNumber.replace("FC-", ""), 10);
  return isNaN(seq) ? 1 : seq + 1;
}

/** Hash a plaintext password with a per-user salt (scrypt). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Verify a plaintext password against a stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** HMAC-sign a value for cookie sessions. */
export function signToken(payload: string): string {
  const secret = process.env.COOKIE_SECRET || "fancard-dev-secret";
  return `${payload}.${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;
}

/** Verify and return an HMAC-signed token. */
export function verifyToken(token: string): string | null {
  const secret = process.env.COOKIE_SECRET || "fancard-dev-secret";
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? payload : null;
}

/** Relative URL to this fan card. */
export function cardUrlFor(slug: string, fanNumber: string): string {
  return `/celebrity/${slug}/fan/${fanNumber}`;
}

/**
 * Generate a premium-looking inline SVG avatar for a celebrity when no
 * photo has been uploaded. Returns a `data:image/svg+xml` URI.
 */
export function avatarDataUri(name: string, accent: string, initials?: string): string {
  const words = name.trim().split(/\s+/);
  const ini = initials ?? words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#0b0c10"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="750" fill="url(#g)"/>
  <circle cx="300" cy="330" r="220" fill="url(#glow)"/>
  <circle cx="300" cy="330" r="150" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>
  <text x="300" y="372" font-family="Arial, Helvetica, sans-serif" font-size="220" font-weight="700" text-anchor="middle" fill="#ffffff">${ini}</text>
  <rect x="120" y="600" width="360" height="6" rx="3" fill="rgba(255,255,255,0.8)"/>
  <text x="300" y="660" font-family="Arial, Helvetica, sans-serif" font-size="34" letter-spacing="6" text-anchor="middle" fill="rgba(255,255,255,0.95)">OFFICIAL FAN</text>
  <text x="300" y="700" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="3" text-anchor="middle" fill="rgba(255,255,255,0.6)">MEMBER COMMUNITY</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Generate a wide cover image data URI (subtle gradient banner). */
export function coverDataUri(accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600" viewBox="0 0 1600 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="55%" stop-color="#27104a"/>
      <stop offset="100%" stop-color="#0b0c10"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="600" fill="url(#g)"/>
  <g fill="rgba(255,255,255,0.05)">
    <circle cx="200" cy="150" r="120"/>
    <circle cx="1400" cy="450" r="180"/>
    <circle cx="1100" cy="120" r="70"/>
  </g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Simple JSON parse helper with safe default. */
export function tryParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type SocialLinks = {
  instagram?: string;
  x?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  official?: string;
};

export type CardDesign = {
  primary?: string;
  accent?: string;
  gradientFrom?: string;
  gradientTo?: string;
  showPhoto?: boolean;
  watermark?: string;
  badgeText?: string;
};

export type MembershipLevelType = {
  id: string;
  name: string;
  description?: string | null;
  benefits?: string | null;
  price?: number | null;
  currency?: string;
  displayOrder: number;
  isActive: boolean;
};

/** Default card design for a celebrity when none is configured. */
export function defaultCardDesign(accent: string): CardDesign {
  return {
    primary: accent,
    accent: "#f59e0b",
    gradientFrom: accent,
    gradientTo: "#0b0c10",
    showPhoto: true,
    watermark: "OFFICIAL FAN MEMBER",
    badgeText: "FAN CARD",
  };
}