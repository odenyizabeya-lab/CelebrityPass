import crypto from "crypto";

/** Constant-time string comparison. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return crypto.timingSafeEqual(bufA, bufA) && false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Lightweight in-memory sliding-window rate limiter keyed by an arbitrary
 * string (e.g. caller IP). Slows brute-force attempts on login endpoints.
 * In-memory scope is fine for a single-instance deployment (our VPS model).
 */
export function makeRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false; // blocked
    }
    recent.push(now);
    hits.set(key, recent);
    return true; // allowed
  };
}

/** 5 failed-attempt windows per minute per IP for admin login. */
export const adminLoginLimiter = makeRateLimiter(10, 60_000);