import crypto from "node:crypto";

/**
 * Fan session cookie: signing, verification and expiry.
 *
 * Edge-runtime safe on purpose — `src/proxy.ts` imports this on every request,
 * so it must not pull in Prisma, `next/headers` or anything else heavy.
 *
 * FORMAT
 * ------
 * v2 (current): `v2.<fanId>.<expiresAtMs>.<hmac>`
 * v1 (legacy):  `<fanId>.<hmac>`
 *
 * The v2 payload carries an explicit expiry so the request-time gate can
 * reject a dead session without a database round-trip. This is the fix for
 * "invalid saved session data": previously the cookie signature was the only
 * check, so a session for a deleted or suspended account kept verifying for the
 * full 30-day cookie lifetime and every personalised page then blew up on a
 * missing user row.
 *
 * v1 tokens are still accepted. They cannot outlive their own cookie (the
 * browser drops the cookie at max-age), so accepting them is safe and means
 * existing signed-in fans are not logged out by this deploy.
 */

export const FAN_COOKIE = "fc_fan";

/** Session lifetime. Kept in sync with the cookie max-age below. */
export const SESSION_TTL_MS = 60 * 60 * 1000 * 24 * 30; // 30 days

const VERSION = "v2";

/**
 * Session-signing secret. Fail-closed in production: without a real secret an
 * attacker could forge any fan session, so we refuse rather than fall back to a
 * well-known value.
 */
function sessionSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "COOKIE_SECRET is not set. It is required in production to prevent session forgery.",
    );
  }
  return "fancard-dev-secret";
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

/** A SHA-256 digest is exactly 32 bytes, i.e. 64 hex characters. */
const HEX_SHA256 = /^[0-9a-f]{64}$/i;

/**
 * Constant-time compare of two hex digests.
 *
 * The format is validated first, and that is a security requirement rather than
 * tidiness: `Buffer.from(str, "hex")` silently stops at the first non-hex
 * character instead of failing, so a token whose signature had any garbage
 * appended decoded to the same 32 bytes as the real one and verified
 * successfully. Requiring exactly 64 hex characters closes that hole before the
 * comparison is reached.
 */
function safeEqual(a: string, b: string): boolean {
  if (!HEX_SHA256.test(a) || !HEX_SHA256.test(b)) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Issues a signed session token for a fan. */
export function signSessionToken(fanId: string, ttlMs: number = SESSION_TTL_MS): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${VERSION}.${fanId}.${expiresAt}`;
  return `${payload}.${hmac(payload)}`;
}

/**
 * Verifies a session token and returns the fan id, or null when the token is
 * missing, malformed, forged, or past its expiry.
 */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length === 4 && parts[0] === VERSION) {
      const [, fanId, expiresAtRaw, sig] = parts;
      const expiresAt = Number(expiresAtRaw);
      if (!fanId || !Number.isFinite(expiresAt) || !safeEqual(sig, hmac(`${VERSION}.${fanId}.${expiresAtRaw}`))) {
        return null;
      }
      if (Date.now() > expiresAt) return null;
      return fanId;
    }

    // Legacy v1: `<fanId>.<hmac>`. Bounded by the cookie's own max-age.
    if (parts.length === 2) {
      const [fanId, sig] = parts;
      if (!fanId) return null;
      return safeEqual(sig, hmac(fanId)) ? fanId : null;
    }

    return null;
  } catch {
    // A missing COOKIE_SECRET throws inside hmac(); treat as unauthenticated.
    return null;
  }
}
