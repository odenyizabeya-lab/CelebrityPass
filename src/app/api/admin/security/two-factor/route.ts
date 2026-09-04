import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  getAdminEmail,
  getAdminPasswordHash,
  getAdminTotpSecret,
  isTwoFactorEnabled,
  setAdminTotpSecret,
  enableTwoFactor,
  disableTwoFactor,
} from "@/lib/admin/settings";
import { verifyPassword } from "@/lib/utils";
import { verifyTotp, generateTotpSecret, totpProvisioningUri } from "@/lib/admin/totp";

export const dynamic = "force-dynamic";

// GET /api/admin/security/two-factor — status + (when not yet enabled) provisioning URI.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let secret = await getAdminTotpSecret();
  const enabled = await isTwoFactorEnabled();
  // When 2FA is off and no secret exists yet, generate one now so the admin can
  // immediately scan a QR or copy it into their authenticator app.
  if (!enabled && !secret) {
    secret = generateTotpSecret();
    await setAdminTotpSecret(secret);
  }
  return NextResponse.json({
    enabled,
    provisioningUri: enabled || !secret ? null : totpProvisioningUri(secret, await getAdminEmail()),
    // Shown only while enrollment is pending (2FA not yet enabled) so the admin
    // can enter it manually in an authenticator app. Never returned once on.
    manualSecret: enabled || !secret ? null : secret,
  });
}

// POST /api/admin/security/two-factor
//   { action: "enable",  currentPassword, code }  → enroll + confirm a code
//   { action: "disable", currentPassword }        → turn 2FA off
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const current = String(body?.currentPassword ?? "");

  const hash = await getAdminPasswordHash();
  if (!hash || !verifyPassword(current, hash)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  }

  if (action === "enable") {
    let secret = await getAdminTotpSecret();
    if (!secret) {
      secret = generateTotpSecret();
      await setAdminTotpSecret(secret);
    }
    const code = String(body?.code ?? "");
    if (!verifyTotp(secret, code)) {
      return NextResponse.json(
        { error: "That verification code is invalid. Scan the code in your authenticator app and try again." },
        { status: 400 },
      );
    }
    await enableTwoFactor();
    return NextResponse.json({ ok: true, enabled: true, message: "Two-step verification is now on." });
  }

  if (action === "disable") {
    await disableTwoFactor();
    return NextResponse.json({ ok: true, enabled: false, message: "Two-step verification is off." });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}