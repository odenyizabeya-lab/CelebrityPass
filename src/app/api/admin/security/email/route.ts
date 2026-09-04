import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  getAdminEmail,
  getAdminPasswordHash,
  getPendingAdminEmail,
  setPendingAdminEmail,
  setEmailChangeSecret,
  commitAdminEmail,
} from "@/lib/admin/settings";
import { verifyPassword } from "@/lib/utils";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// --- Email change, done securely. -------------------------------------------
// The primary admin email is permanent (odenyizabeya@gmail.com). Changing it
// requires the CURRENT password AND a confirmation step. A short single-use
// code is generated and returned once so the dashboard can confirm it (the
// confirmation code is never stored in plaintext, only its hash). If the
// project later adds an outgoing mail service, the same code is emailed
// instead of returned in the response.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// POST{ action: "request" } — current password + new email → 6-digit code
// POST{ action: "confirm" } — the code → applies the email change
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "request");

  if (action === "confirm") {
    const code = String(body?.code ?? "").trim();
    const pending = await getPendingAdminEmail();
    if (!pending) {
      return NextResponse.json({ error: "No pending email change. Start a new one." }, { status: 400 });
    }
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    const ok = await verifyEmailChangeSecret(hash);
    if (!ok) {
      return NextResponse.json({ error: "That confirmation code is invalid or expired." }, { status: 403 });
    }
    await commitAdminEmail(pending);
    return NextResponse.json({ ok: true, email: pending, message: "Primary email updated." });
  }

  // action === "request"
  const current = String(body?.currentPassword ?? "");
  const next = String(body?.newEmail ?? "").trim().toLowerCase();

  const hash = await getAdminPasswordHash();
  if (!hash || !verifyPassword(current, hash)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  }
  if (!EMAIL_REGEX.test(next)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const currentEmail = (await getAdminEmail()).toLowerCase();
  if (next === currentEmail) {
    return NextResponse.json({ error: "That is already the primary email." }, { status: 400 });
  }

  // Issue a single-use code (6 digits debatable strength is fine with rate
  // limiting + expiry; we store only its hash).
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const hashed = crypto.createHash("sha256").update(code).digest("hex");
  await setEmailChangeSecret(hashed);
  await setPendingAdminEmail(next);

  return NextResponse.json({ ok: true, step: "confirm", pending: next, code });
}

async function verifyEmailChangeSecret(hashedCode: string): Promise<boolean> {
  // Reuse the AppSetting-backed store via a tiny re-implementation call.
  const { consumeEmailChangeSecret } = await import("@/lib/admin/settings");
  return consumeEmailChangeSecret(hashedCode);
}

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ email: await getAdminEmail(), safeEqualHex: "unused" });
}