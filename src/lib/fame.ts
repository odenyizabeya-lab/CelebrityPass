/**
 * Per-celebrity "Registered Fans" figures.
 *
 * Every celebrity gets ONE permanent, unique auto-assigned fan number between
 * 9,272 and 5,000,000. The tier (big vs small) is judged from Google-style
 * knowledge-panel data (see google-info.ts — Wikipedia/Wikidata, the same
 * public sources that power Google's panel): celebrities with a substantial,
 * well-documented public profile land in the big tier (1M–5M); unknown or
 * minor names land in the small tier (9,272–999,999).
 *
 * Uniqueness is guaranteed forever: allocated numbers are persisted in
 * `Celebrity.displayFanCount` (unique column) and every allocation re-checks
 * every already-assigned number so two celebrities can never share a figure.
 */

import { prisma } from "./db";
import { tryParseJson } from "./utils";
import {
  FANS_MIN,
  FANS_LOW_MAX,
  FANS_BIG_MIN,
  FANS_CEILING,
} from "./display";
import type { GoogleInfo } from "./google-info";

/** Google-panel fame score required to be a "big" celebrity. */
export const BIG_FAME_SCORE = 14;

export type FameTier = "big" | "low";

export type FollowerSource = {
  instagramFollowers?: number | null;
  tiktokFollowers?: number | null;
  facebookFollowers?: number | null;
};

/** Largest real following across the celebrity's social platforms. */
export function maxFollowers(c: FollowerSource): number {
  return Math.max(
    c.instagramFollowers ?? 0,
    c.tiktokFollowers ?? 0,
    c.facebookFollowers ?? 0,
  );
}

/**
 * 0..∞ fame score from Google-panel data. Big names score high (long overview,
 * many occupations/films, known birthdate); missing panels score ~0.
 */
export function fameScore(info: GoogleInfo | null, socialFollowers: number): number {
  if (!info) return 0;
  let score = 0;
  const overview = (info.overview ?? "").trim();
  if (overview) score += 4 + Math.min(40, overview.length / 50);
  const desc = (info.description ?? "").trim();
  if (desc) score += Math.min(6, desc.length / 10);
  score += Math.min(8, (info.occupations?.length ?? 0) * 2);
  score += Math.min(20, (info.films?.length ?? 0) * 2);
  if (info.born) score += 4;
  const sites = info.siteLinks ?? 0;
  score += Math.min(30, sites / 3);
  score += Math.min(10, (socialFollowers / 5_000_000) * 2);
  return score;
}

export function fameTier(info: GoogleInfo | null, socialFollowers: number): FameTier {
  return fameScore(info, socialFollowers) >= BIG_FAME_SCORE ? "big" : "low";
}

function seededInt(seed: string, bound: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % Math.max(1, bound);
}

/** A deterministic, organic-looking (non-round) number for a slug+tier. */
export function fanCountCandidate(slug: string, tier: FameTier): number {
  const [lo, hi] = tier === "big" ? [FANS_BIG_MIN, FANS_CEILING] : [FANS_MIN, FANS_LOW_MAX];
  return lo + seededInt(`${slug}:registered-fans`, hi - lo + 1);
}

/**
 * Assign a unique fan number for a slug+tier, scanning every already-assigned
 * number so the result always differs from every other celebrity's figure.
 */
export async function allocateFanNumber(slug: string, tier: FameTier): Promise<number> {
  const rows = await prisma.celebrity.findMany({
    where: { displayFanCount: { not: null } },
    select: { displayFanCount: true },
  });
  const used = new Set<number>();
  for (const r of rows) {
    if (r.displayFanCount != null) used.add(r.displayFanCount);
  }
  const [lo, hi] = tier === "big" ? [FANS_BIG_MIN, FANS_CEILING] : [FANS_MIN, FANS_LOW_MAX];
  let n = fanCountCandidate(slug, tier);
  let guard = 0;
  while (used.has(n) && guard++ < 10_000) {
    n += 41;
    if (n > hi) n = lo + ((n - lo) % (hi - lo + 1));
  }
  return n;
}

/**
 * The displayed fan number for a celebrity row: the persisted unique figure
 * when present, otherwise a deterministic candidate so nothing ever shows a
 * flickering placeholder before the allocation is saved.
 */
export function displayFanCountFor(c: {
  slug: string;
  displayFanCount?: number | null;
  googleInfo?: string | null;
} & FollowerSource): number {
  if (c.displayFanCount != null) return c.displayFanCount;
  const info = tryParseJson<GoogleInfo | null>(c.googleInfo ?? null, null);
  return fanCountCandidate(c.slug, fameTier(info, maxFollowers(c)));
}

/**
 * Persist a unique fan number for a celebrity. Retries on concurrent
 * unique-key collisions (two creates racing for the same figure) with a fresh
 * scan each time so the number is always distinct from every other celebrity.
 */
export async function assignFanNumber(
  celebrityId: string,
  slug: string,
  tier: FameTier
): Promise<number | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const number = await allocateFanNumber(slug, tier);
      await prisma.celebrity.update({ where: { id: celebrityId }, data: { displayFanCount: number } });
      return number;
    } catch {
      // unique-key collision from a concurrent create → rescan and retry
    }
  }
  return null;
}