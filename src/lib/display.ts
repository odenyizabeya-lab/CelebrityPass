/**
 * The platform's displayed fan numbers. Real registrations come from the
 * database; the platform totals are a permanent, self-growing floor derived
 * from live data so the numbers always look real and never stop climbing as
 * new communities are added.
 */

/** Starting displayed fan count (the platform's floor). */
export const REGISTERED_FANS_BASE = 9_272;

/** Hard ceiling the counters animate toward. */
export const FANS_CEILING = 1_000_000;

/** Believable base sign-up count every active community contributes. */
export const COMMUNITY_FANS_BASE = 1_000;

/**
 * A single community's displayed fan count: its real registered fans plus the
 * base sign-up count, so a brand-new community never looks empty.
 */
export function communityFans(realCommunityFans: number): number {
  return Math.round(COMMUNITY_FANS_BASE + Math.max(0, realCommunityFans));
}

/**
 * The platform-wide registered-fans total. Always at least REGISTERED_FANS_BASE,
 * grows automatically with every active community and every real registration,
 * and never exceeds FANS_CEILING.
 */
export function platformFans(activeCommunities: number, realRegisteredFans: number): number {
  const organic = activeCommunities * COMMUNITY_FANS_BASE + Math.max(0, Math.round(realRegisteredFans));
  return Math.min(FANS_CEILING, Math.max(REGISTERED_FANS_BASE, organic));
}