import { cookies } from "next/headers";
import { signToken, verifyToken } from "./utils";

const FAN_COOKIE = "fc_fan";

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

export async function createFanSession(fanId: string) {
  const cookieStore = await cookies();
  cookieStore.set(FAN_COOKIE, signToken(fanId), {
    httpOnly: true,
    secure: secureFlag(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearFanSession() {
  const cookieStore = await cookies();
  cookieStore.delete(FAN_COOKIE);
}

export async function getCurrentFanId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(FAN_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return payload;
}

/**
 * Admin session is authenticated through Supabase Auth. This delegates to the
 * server-side Supabase client so every admin API route shares the same gate.
 */
export async function isAdminAuthed(): Promise<boolean> {
  const { createServerSupabase } = await import("@/lib/supabase/server");
  const cookieStore = await cookies();
  if (cookieStore.get("fc_admin")) {
    // Clear the legacy signed-cookie admin session if it still exists.
    cookieStore.delete("fc_admin");
  }
  return (await createServerSupabase()).auth.getUser().then(({ data }) => Boolean(data.user));
}