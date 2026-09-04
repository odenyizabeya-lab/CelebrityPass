import { NextResponse, type NextRequest } from "next/server";
import {
  createAdminSession,
  confirmAdminTwoFactor,
  createAdminTwoFactorStep,
  isAdminAuthed,
  hasPendingAdminTwoFactor,
  clearAdminSession,
} from "@/lib/auth";
import {
  getAdminEmail,
  getAdminPasswordHash,
  getAdminTotpSecret,
  isTwoFactorEnabled,
  bootstrapStatus,
  seedAdminIfNeeded,
} from "@/lib/admin/settings";
import { verifyPassword } from "@/lib/utils";
import { verifyTotp } from "@/lib/admin/totp";
import { timingSafeEqualStr, adminLoginLimiter } from "@/lib/secure";

export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * POST /api/admin/auth
 *
 * Two-step sign-in:
 *   body: { step: "1", email, password }   → returns { next: "2fa" | "done" }
 *   body: { step: "2", code }              → returns { ok: true }
 *
 * Password is stored only as a scrypt `salt:hash`. The primary email is fixed
 * to odenyizabeya@gmail.com and cannot be swapped silently by a deployment —
 * changing it always requires the current password from the dashboard.
 */
export async function POST(request: NextRequest) {
  if (!adminLoginLimiter(clientIp(request))) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const step = String(body?.step ?? "1");

  // Step 2: finish sign-in with a TOTP code.
  if (step === "2") {
    if (!(await hasPendingAdminTwoFactor())) {
      return NextResponse.json({ error: "Two-step session expired. Sign in again." }, { status: 401 });
    }
    const code = String(body?.code ?? "");
    const secret = await getAdminTotpSecret();
    const enabled = await isTwoFactorEnabled();
    if (!enabled || !secret || !verifyTotp(secret, code)) {
      return NextResponse.json({ error: "The verification code is invalid or expired." }, { status: 401 });
    }
    const email = await getAdminEmail();
    await confirmAdminTwoFactor(email);
    return NextResponse.json({ ok: true });
  }

  // Step 1: verify email + password.
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  // On the very first sign-in attempt, provision the admin account from the
  // configured password if a hash does not exist yet.
  await seedAdminIfNeeded();

  const status = await bootstrapStatus();
  if (status === "not_configured") {
    return NextResponse.json({ error: "Admin account is not configured." }, { status: 403 });
  }

  const hash = await getAdminPasswordHash();
  if (!hash || !hash.includes(":")) {
    return NextResponse.json({ error: "Admin account is not configured." }, { status: 403 });
  }

  const expectedEmail = (await getAdminEmail()).toLowerCase();
  if (!timingSafeEqualStr(email, expectedEmail) || !verifyPassword(password, hash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Password accepted. Decide whether a second step is required.
  if (await isTwoFactorEnabled()) {
    await createAdminTwoFactorStep(expectedEmail);
    return NextResponse.json({ next: "2fa" });
  }
  await createAdminSession(expectedEmail);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const authed = await isAdminAuthed();
  const pending = await hasPendingAdminTwoFactor();
  return NextResponse.json({
    authed,
    pending2fa: !authed && pending,
    configured: (await bootstrapStatus()) === "configured",
  });
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}