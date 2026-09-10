/**
 * The platform's displayed fan numbers. Real registrations come from the
 * database; every celebrity gets one unique auto-assigned "Registered Fans"
 * figure (see fame.ts), and the platform total is the sum of those figures
 * plus real registrations — always at least 9,272, always climbing as new
 * communities are added, and never above 5,000,000.
 */

/** Starting displayed fan count (the platform's floor). */
export const REGISTERED_FANS_BASE = 9_272;

/** Small celebrities get a figure in [FANS_MIN, FANS_LOW_MAX]. */
export const FANS_MIN = REGISTERED_FANS_BASE;

/** Hard ceiling the counters animate toward. */
export const FANS_CEILING = 5_000_000;

/**
 * Every community's displayed "Countries Represented" figure. The platform's
 * represented-country total (starting from a curated base list and growing the
 * moment any celebrity or fan from a new country is added) is what's shown on
 * EVERY celebrity profile and card — so a community can never show fewer than
 * this floor and always grows toward the highest country total on the platform.
 */
export const COUNTRIES_REPRESENTED_BASE = 58;

/**
 * A community's "Countries Represented" total: at least the 58-country floor,
 * and at most the platform's highest represented-country total.
 */
export function displayCountryCount(platformTotalCountries: number): number {
  return Math.max(COUNTRIES_REPRESENTED_BASE, Math.max(0, Math.round(platformTotalCountries)));
}

/** Small celebrities get a figure in [FANS_MIN, FANS_LOW_MAX]. */
export const FANS_LOW_MAX = 999_999;

/** Big celebrities get a figure in [FANS_BIG_MIN, FANS_CEILING]. */
export const FANS_BIG_MIN = 1_000_000;

/**
 * The platform-wide registered-fans total: the sum of every community's
 * displayed fan figure plus real registrations, clamped between the base floor
 * and the ceiling.
 */
export function platformTotal(displayedFanCounts: number[], realRegisteredFans: number): number {
  const organic =
    displayedFanCounts.reduce((a, b) => a + Math.max(0, b), 0) + Math.max(0, Math.round(realRegisteredFans));
  return Math.min(FANS_CEILING, Math.max(REGISTERED_FANS_BASE, organic));
}