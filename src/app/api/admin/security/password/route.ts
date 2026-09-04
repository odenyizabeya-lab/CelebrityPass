import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  getAdminPasswordHash,
  setAdminPasswordHash,
} from "@/lib/admin/settings";
import { verifyPassword, hashPassword } from "@/lib/utils";

export const dynamic = "force-dynamic";

// POST /api/admin/security/password — change the admin password.
// Requires the CURRENT password to verify the request is from the account owner.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const current = String(body?.currentPassword ?? "");
  const next = String(body?.newPassword ?? "");
  const confirm = String(body?.confirmPassword ?? "");

  const hash = await getAdminPasswordHash();
  if (!hash || !verifyPassword(current, hash)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  }

  if (next.length < 10) {
    return NextResponse.json({ error: "New password must be at least 10 characters." }, { status: 400 });
  }
  if (next !== confirm) {
    return NextResponse.json({ error: "New passwords do not match." }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: "New password must be different from the current password." }, { status: 400 });
  }

  await setAdminPasswordHash(hashPassword(next));
  return NextResponse.json({ ok: true, message: "Password updated." });
}