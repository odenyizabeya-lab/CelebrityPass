import { cookies } from "next/headers";
import { signToken, verifyToken } from "./utils";

const ADMIN_COOKIE = "fc_admin";
const FAN_COOKIE = "fc_fan";

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
 * Admin session. Rather than a magic "admin" string we now carry a small
 * JSON object in the signed cookie so the server can also signal a pending
 * two-step-verification step. Real admin access requires a session with the
 * "ok" field; a session marked "step2" means the password matched but the
 * admin has not yet proven they hold the 2FA device.
 */
type AdminSession = {
  r: "admin";
  e: string; // email used at login
  ok?: boolean; // set → fully authenticated
  pending2fa?: boolean; // set → password accepted, 2FA code still required
};

export function encodeAdminSession(session: AdminSession): string {
  return signToken(JSON.stringify(session));
}

function decodeAdminSession(token: string): AdminSession | null {
  const raw = verifyToken(token);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AdminSession;
    if (parsed?.r !== "admin") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const session = decodeAdminSession(token);
  return Boolean(session && session.ok === true);
}

/** Whether the caller currently holds a session that is blocked on 2FA. */
export async function hasPendingAdminTwoFactor(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const session = decodeAdminSession(token);
  return Boolean(session && session.pending2fa === true && session.ok !== true);
}

/** Create a fully authenticated admin session (used after 2FA passes). */
export async function createAdminSession(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, encodeAdminSession({ r: "admin", e: email, ok: true }), {
    httpOnly: true,
    secure: secureFlag(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h, sliding renewal handled at next login
  });
}

/**
 * Place a "pending 2FA" marker. The caller can only reach this state after
 * their password has been verified; here we also record the email used so the
 * 2FA step knows which account to finish signing in.
 */
export async function createAdminTwoFactorStep(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, encodeAdminSession({ r: "admin", e: email, pending2fa: true }), {
    httpOnly: true,
    secure: secureFlag(),
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // short window to complete the 2nd step
  });
}

/** Complete the pending 2FA step → upgrade to a full session for `email`. */
export async function confirmAdminTwoFactor(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, encodeAdminSession({ r: "admin", e: email, ok: true }), {
    httpOnly: true,
    secure: secureFlag(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}