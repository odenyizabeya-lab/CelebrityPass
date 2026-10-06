import { cookies } from "next/headers";
import { FAN_COOKIE, signSessionToken, verifySessionToken, SESSION_TTL_MS } from "./session-token";
import { markOnboarded } from "./onboarding";

export { FAN_COOKIE } from "./session-token";

/**
 * Admin authentication is handled by Supabase Auth. The legacy signed-cookie
 * admin session is no longer used; `isAdminAuthed` below now resolves against
 * the current Supabase session so every admin API route stays protected. The
 * legacy `fc_admin` cookie is cleared on read in case it lingers from an older
 * version.
 */

/** Cookies only ever travel over HTTPS in production. */
function secureFlag() {
  return process.env.NODE_ENV === "production";
}

/**
 * Establishes an authenticated fan session.
 *
 * The token carries its own expiry (mirrored by the cookie max-age) so a stale
 * or tampered cookie is rejected at the request gate rather than silently
 * admitting a deleted or suspended account into personalised pages.
 */
export async function createFanSession(fanId: string) {
  const cookieStore = await cookies();
  cookieStore.set(FAN_COOKIE, signSessionToken(fanId), {
    httpOnly: true,
    secure: secureFlag(),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  // An authenticated fan has completed onboarding — never re-show the welcome.
  await markOnboarded();
}

export async function clearFanSession() {
  const cookieStore = await cookies();
  cookieStore.delete(FAN_COOKIE);
}

/**
 * The fan id for the current session, or null.
 *
 * Cookie verification only — no database round-trip, so it is safe to call from
 * anywhere. Callers that are about to render personalised data should prefer
 * `getSession()` from `@/lib/session`, which also confirms the account still
 * exists and is active.
 */
export async function getCurrentFanId(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(FAN_COOKIE)?.value);
}

/**
 * Admin session is authenticated through Supabase Auth. This delegates to the
 * server-side Supabase client so every admin API route shares the same gate.
 * Fails closed: if Supabase errors, this returns false (never grants access).
 */
export async function isAdminAuthed(): Promise<boolean> {
  const { isAdminAuthedSupabase } = await import("@/lib/supabase/server");
  const cookieStore = await cookies();
  if (cookieStore.get("fc_admin")) {
    // Clear the legacy signed-cookie admin session if it still exists.
    cookieStore.delete("fc_admin");
  }
  try {
    return await isAdminAuthedSupabase();
  } catch {
    return false;
  }
}

/**
 * Email of the currently authenticated admin (null when no admin session).
 * Used to stamp team chat messages with the responsible team member.
 */
export async function getCurrentAdminEmail(): Promise<string | null> {
  const { getCurrentAdminEmail: resolve } = await import("@/lib/supabase/server");
  try {
    return await resolve();
  } catch {
    return null;
  }
}