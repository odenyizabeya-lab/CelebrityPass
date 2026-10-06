import { cookies, headers } from "next/headers";
import { verifySessionToken, FAN_COOKIE } from "@/lib/session-token";
import { isNativeUserAgent } from "@/lib/routes";

/**
 * Server-side session state — the single place that answers "is this request
 * signed in?".
 *
 * WHY THIS EXISTS
 * ---------------
 * The old flow had three unrelated notions of "onboarding" and no single auth
 * check:
 *
 *  1. `cp_app_welcomed` — a 1-year cookie written by `POST
 *     /api/onboarding/complete`, which the Welcome screen AND the
 *     "Continue without an account" button both called. So a logged-out
 *     visitor permanently unlocked the personalised home app after one tap.
 *  2. `fc_fan` — the real session, but signed with no embedded expiry, so a
 *     deleted/suspended fan's cookie kept verifying for 30 days and every page
 *     then crashed on a missing user row.
 *  3. Each page re-implemented its own `getCurrentFanId().catch(() => null)`
 *     guard, so one bad page could forget to check.
 *
 * This module centralises all of it: one `getSession()` that every page, layout
 * and API route uses, plus `requireFan()` which is the only supported way to
 * enter a personalised screen.
 */

export type SessionStatus = "authenticated" | "anonymous";

export interface SessionInfo {
  /** Resolved auth state for this request. */
  status: SessionStatus;
  /** Fan id when authenticated, otherwise null. */
  fanId: string | null;
  /** True when the request came from the Capacitor mobile shell. */
  isNative: boolean;
  /**
   * True when a session cookie was present but rejected (bad signature, wrong
   * format, or past its embedded expiry). Used to show "Your session has
   * expired. Please log in again." instead of a generic "not signed in".
   */
  expired: boolean;
}

/** Cookie names owned by the session/onboarding flow. */
export { FAN_COOKIE } from "@/lib/session-token";

const WELCOME_COOKIE = "cp_app_welcomed";

/** True when the request came from the native app shell. */
export async function isNativeRequest(): Promise<boolean> {
  try {
    const h = await headers();
    return isNativeUserAgent(h.get("user-agent"));
  } catch {
    return false;
  }
}

/**
 * Reads and validates the fan session cookie WITHOUT touching the database.
 * This is what the proxy (edge runtime, no Prisma) uses, and it is a pure
 * function of the cookie so it is safe to call on every request.
 *
 * Returns the fan id, or null when there is no/unusable cookie.
 */
export function readSessionToken(cookieValue: string | undefined): {
  fanId: string | null;
  expired: boolean;
} {
  if (!cookieValue) return { fanId: null, expired: false };
  const fanId = verifySessionToken(cookieValue);
  if (fanId) return { fanId, expired: false };
  // Distinguish "malformed/garbage" from "well-formed but past expiry" so the
  // UI can say the honest thing.
  return { fanId: null, expired: isExpiredSessionToken(cookieValue) };
}

/** True when the token parses cleanly but its embedded expiry has passed. */
function isExpiredSessionToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v2") return false;
  const exp = Number(parts[2]);
  return Number.isFinite(exp) && exp > 0 && Date.now() > exp;
}

/**
 * Full server-side session check.
 *
 * Unlike the cookie-only check this also confirms the fan row still exists and
 * is active, so a suspended/deleted account cannot keep browsing with a stale
 * cookie (which previously made personalised pages throw on a null user). A
 * DB failure is treated as "anonymous" rather than propagated, so a database
 * blip never turns into a 500.
 */
export async function getSession(): Promise<SessionInfo> {
  const isNative = await isNativeRequest();

  let cookieValue: string | undefined;
  try {
    const store = await cookies();
    cookieValue = store.get(FAN_COOKIE)?.value;
  } catch {
    return { status: "anonymous", fanId: null, isNative, expired: false };
  }

  const { fanId, expired } = readSessionToken(cookieValue);
  if (!fanId) return { status: "anonymous", fanId: null, isNative, expired };

  // Only pay for a DB round-trip when there is a real session to validate, and
  // never let a DB error grant access (fail closed).
  try {
    const { prisma } = await import("@/lib/db");
    const fan = await prisma.fan.findUnique({
      where: { id: fanId },
      select: { id: true, isActive: true },
    });
    if (!fan || !fan.isActive) {
      await clearInvalidSession();
      return { status: "anonymous", fanId: null, isNative, expired: true };
    }
    return { status: "authenticated", fanId: fan.id, isNative, expired: false };
  } catch {
    // Database unavailable: treat as anonymous and let the user sign in again
    // rather than rendering a personalised page with no data.
    return { status: "anonymous", fanId: null, isNative, expired };
  }
}

/** Convenience: true when the current request is signed in. */
export async function isAuthenticated(): Promise<boolean> {
  return (await getSession()).status === "authenticated";
}

/** Drops a session cookie that no longer resolves to an active fan. */
async function clearInvalidSession(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(FAN_COOKIE);
  } catch {
    // Deleting a cookie must never break the response.
  }
}

/**
 * True when the visitor has already dismissed the first-run welcome screen.
 * Purely a UI preference — it grants NO access to anything. Auth is decided
 * exclusively by the fan session.
 */
export async function hasSeenWelcome(): Promise<boolean> {
  try {
    const store = await cookies();
    return store.get(WELCOME_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}
