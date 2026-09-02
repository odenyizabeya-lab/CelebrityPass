/**
 * Follower-count helpers. Counts are public, approximate figures stored per
 * celebrity and editable from the admin panel. New celebrities are given
 * realistic auto-generated counts so nothing works manually.
 */

export type FollowerCounts = {
  instagramFollowers?: number | null;
  tiktokFollowers?: number | null;
  facebookFollowers?: number | null;
};

/** Format a follower count into a compact, human-friendly string. */
export function formatFollowerCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/** Stable 0..1 hash from a string so the same name always gets the same numbers. */
function stableSeed(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000 / 1000; // 0..1
}

type Range = { min: number; max: number; base: number };

/** Realistic follower ranges by category (in millions). */
const CATEGORY_RANGES: Record<string, { ig: Range; tt: Range; fb: Range }> = {
  Musician: {
    ig: { min: 25, max: 280, base: 90 },
    tt: { min: 18, max: 220, base: 60 },
    fb: { min: 8, max: 80, base: 30 },
  },
  Actor: {
    ig: { min: 6, max: 180, base: 45 },
    tt: { min: 4, max: 90, base: 20 },
    fb: { min: 10, max: 70, base: 28 },
  },
  Athlete: {
    ig: { min: 15, max: 500, base: 120 },
    tt: { min: 8, max: 200, base: 45 },
    fb: { min: 12, max: 130, base: 40 },
  },
  Creator: {
    ig: { min: 4, max: 90, base: 22 },
    tt: { min: 25, max: 300, base: 80 },
    fb: { min: 2, max: 30, base: 8 },
  },
  Artist: {
    ig: { min: 1, max: 18, base: 5 },
    tt: { min: 1, max: 12, base: 3 },
    fb: { min: 2, max: 14, base: 5 },
  },
  "Public Figure": {
    ig: { min: 3, max: 55, base: 15 },
    tt: { min: 2, max: 40, base: 10 },
    fb: { min: 8, max: 110, base: 30 },
  },
};

function pickIn(range: Range, seed: number): number {
  const t = (range.max - range.min) * seed + range.min;
  return Math.round(t); // millions
}

/**
 * Auto-generated follower counts for a brand-new celebrity. Values are stable
 * per name and fall in realistic ranges for the category. The admin can always
 * overwrite them with the celebrity's real published numbers.
 */
export function defaultFollowerCounts(category: string, name: string): FollowerCounts {
  const seed = stableSeed(name);
  const r = CATEGORY_RANGES[category] ?? CATEGORY_RANGES["Public Figure"];
  const scale = (n: number) => Math.max(1, Math.round(n * 10) * 100_000);
  return {
    instagramFollowers: scale(pickIn(r.ig, seed)),
    tiktokFollowers: scale(pickIn(r.tt, seed)),
    facebookFollowers: scale(pickIn(r.fb, seed)),
  };
}

export const FANDOM_PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
] as const;