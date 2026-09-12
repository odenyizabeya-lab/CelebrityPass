/**
 * Resilience wrappers.
 *
 * A failed network / database / API call must NEVER take down a page. These
 * helpers convert loaders that throw (or resolve to null/undefined) into a
 * caller-supplied fallback so the page shell always renders, and can show an
 * inline "couldn't load" state instead of crashing the whole screen.
 */

/** Run a synchronous loader, returning `fallback` if it throws or returns null/undefined. */
export function safe<T>(loader: () => T, fallback: T): T {
  try {
    const value = loader();
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

/** Run an async loader, returning `fallback` if it rejects or resolves to null/undefined. */
export async function safeAsync<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const value = await loader();
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

/** True when a value is a non-null object (defensive instanceof guard). */
export function isNonNull(value: unknown): boolean {
  return value !== null && value !== undefined;
}

/**
 * Parse an ISO timestamp defensively. Returns null for any input that is not a
 * valid date. Callers use this before calling .toLocaleString() etc. so an
 * unexpected value can never render "Invalid Date"/"NaN:NaN".
 */
export function safeDateValue(value: string | Date | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}