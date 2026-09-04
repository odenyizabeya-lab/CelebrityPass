/**
 * Admin account identity stored server-side in the AppSetting table.
 *
 * Unlike the old single-env-var password approach, the admin account now has a
 * stable record in the database: a fixed primary email, a scrypt-hashed
 * password, and an optional TOTP (RFC 6238) two-step verification secret.
 *
 * The ONLY stored password form is `salt:hash` from crypto.scryptSync — plain
 * text is never persisted and never transmitted. The dashboard only ever reads
 * booleans (which settings are configured), never the secret values themselves.
 *
 * The permanent primary admin email defaults to odenyizabeya@gmail.com and can
 * only be changed from the dashboard by entering the current password, so a
 * deployment/update can never silently reset it to a demo or generated value.
 */

import { prisma } from "@/lib/db";

export const ADMIN_EMAIL_SETTING = "admin.primary_email";
export const ADMIN_PASSWORD_SETTING = "admin.password_hash";
export const ADMIN_2FA_SECRET_SETTING = "admin.totp_secret";
export const ADMIN_2FA_ENABLED_SETTING = "admin.totp_enabled";

/** Permanent primary admin email. This is the initial value and the default. */
export const DEFAULT_ADMIN_EMAIL = "odenyizabeya@gmail.com";

async function getSetting(key: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? "";
}

async function setSetting(key: string, value: string): Promise<void> {
  if (!value) {
    await prisma.appSetting.deleteMany({ where: { key } });
    return;
  }
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** Public-facing admin email. Falls back to the permanent default when unset. */
export async function getAdminEmail(): Promise<string> {
  const v = await getSetting(ADMIN_EMAIL_SETTING);
  return v || DEFAULT_ADMIN_EMAIL;
}

/** True once a password hash has been stored (login is configured). */
export async function hasAdminPassword(): Promise<boolean> {
  const h = await getSetting(ADMIN_PASSWORD_SETTING);
  return h.includes(":");
}

/** Read the stored password hash (server-side only). */
export async function getAdminPasswordHash(): Promise<string> {
  return getSetting(ADMIN_PASSWORD_SETTING);
}

/** Store the scrypt password hash. */
export async function setAdminPasswordHash(hash: string): Promise<void> {
  await setSetting(ADMIN_PASSWORD_SETTING, hash);
}

/** Whether two-step verification is enabled. */
export async function isTwoFactorEnabled(): Promise<boolean> {
  return (await getSetting(ADMIN_2FA_ENABLED_SETTING)) === "true" && Boolean(await getAdminTotpSecret());
}

/** Read the TOTP secret (server-side only, never returned to the client). */
export async function getAdminTotpSecret(): Promise<string> {
  return getSetting(ADMIN_2FA_SECRET_SETTING);
}

/**
 * Enroll a new TOTP secret. Setting the secret alone does not enable 2FA —
 * it is only enabled after the admin proves they can produce valid codes.
 */
export async function setAdminTotpSecret(secret: string): Promise<void> {
  await setSetting(ADMIN_2FA_SECRET_SETTING, secret);
  // While enrolled but not yet confirmed, 2FA stays off.
  await setSetting(ADMIN_2FA_ENABLED_SETTING, "false");
}

/** Turn 2FA on (the admin has confirmed a valid code from their app). */
export async function enableTwoFactor(): Promise<void> {
  await setSetting(ADMIN_2FA_ENABLED_SETTING, "true");
}

/** Turn 2FA off (confirmed with the current password by the admin). */
export async function disableTwoFactor(): Promise<void> {
  await setSetting(ADMIN_2FA_ENABLED_SETTING, "false");
}

/** Whether an email change is currently "pending confirmation" (email-change). */
const ADMIN_EMAIL_PENDING_SETTING = "admin.pending_email";

export async function getPendingAdminEmail(): Promise<string> {
  return getSetting(ADMIN_EMAIL_PENDING_SETTING);
}

export async function setPendingAdminEmail(email: string): Promise<void> {
  await setSetting(ADMIN_EMAIL_PENDING_SETTING, email);
}

export async function clearPendingAdminEmail(): Promise<void> {
  await setSetting(ADMIN_EMAIL_PENDING_SETTING, "");
}

/** Fully apply a (verified) primary email change and clear the pending value. */
export async function commitAdminEmail(email: string): Promise<void> {
  await setSetting(ADMIN_EMAIL_SETTING, email.trim().toLowerCase());
  await clearPendingAdminEmail();
}

/** Email-change verification secret (stored as a SHA-256 hash, not the code). */
const ADMIN_EMAIL_CHANGE_TOKEN_SETTING = "admin.email_change_token";
const ADMIN_EMAIL_CHANGE_AT_SETTING = "admin.email_change_at";
const EMAIL_CHANGE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function setEmailChangeSecret(hashedSecret: string): Promise<void> {
  await setSetting(ADMIN_EMAIL_CHANGE_TOKEN_SETTING, hashedSecret);
  await setSetting(ADMIN_EMAIL_CHANGE_AT_SETTING, String(Date.now()));
}

export async function consumeEmailChangeSecret(hashedSecret: string): Promise<boolean> {
  const atRaw = await getSetting(ADMIN_EMAIL_CHANGE_AT_SETTING);
  const at = Number(atRaw);
  if (!at || Date.now() - at > EMAIL_CHANGE_WINDOW_MS) {
    await clearEmailChangeSecret();
    return false;
  }
  const stored = await getSetting(ADMIN_EMAIL_CHANGE_TOKEN_SETTING);
  if (!stored || stored !== hashedSecret) {
    await clearEmailChangeSecret();
    return false;
  }
  await clearEmailChangeSecret();
  return true;
}

async function clearEmailChangeSecret(): Promise<void> {
  await setSetting(ADMIN_EMAIL_CHANGE_TOKEN_SETTING, "");
  await setSetting(ADMIN_EMAIL_CHANGE_AT_SETTING, "");
}

/** Public "not-authed-until-password-is-configured" state, for first login. */
export type AdminBootstrapStatus =
  | "configured"
  | "not_configured";

export async function bootstrapStatus(): Promise<AdminBootstrapStatus> {
  if (await hasAdminPassword()) return "configured";
  return "not_configured";
}

/** Obvious/committed defaults that must NEVER become the production password. */
const DISALLOWED_PASSWORDS = new Set([
  "FancardAdmin2026!",
  "admin",
  "password",
  "admin123",
  "password123",
  "changeme",
]);

/**
 * One-time bootstrap: store the scrypt hash of the real admin password when no
 * hash exists yet. The password comes only from the ADMIN_PASSWORD env var.
 *
 * Fail-closed in production: if ADMIN_PASSWORD is unset, empty, or one of the
 * obvious default values, we REFUSE to create the account — login stays
 * impossible until the operator sets a real password. This guarantees a
 * deployment/update can never silently reset admin to a demo or committed
 * default. Dev keeps the local convenience fallback so local development works.
 */
export async function seedAdminIfNeeded(): Promise<boolean> {
  if (await hasAdminPassword()) return true;

  const provided = process.env.ADMIN_PASSWORD ?? "";
  let effective = "";
  if (provided) {
    effective = provided;
  } else if (process.env.NODE_ENV !== "production") {
    // Local dev convenience ONLY. Never a production default.
    effective = "FancardAdmin2026!";
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    if (!provided || provided.length < 12 || DISALLOWED_PASSWORDS.has(provided)) {
      return false; // do not write any hash; account stays locked
    }
  }
  if (effective.length < 8) return false;

  const { hashPassword } = await import("@/lib/utils");
  await setAdminPasswordHash(hashPassword(effective));
  return true;
}