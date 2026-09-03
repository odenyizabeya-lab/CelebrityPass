import { NextResponse, type NextRequest } from "next/server";
import { createAdminSession, isAdminAuthed, clearAdminSession } from "@/lib/auth";
import { timingSafeEqualStr, adminLoginLimiter } from "@/lib/secure";

export const dynamic = "force-dynamic";

/**
 * Resolve the admin password. Fail-closed in production: ADMIN_PASSWORD MUST be
 * set, otherwise admin login is impossible (no guessable committed default).
 */
function adminPassword(): string {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV === "production") return "";
  return "FancardAdmin2026!";
}

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  // Throttle brute-force attempts per caller IP.
  if (!adminLoginLimiter(clientIp(request))) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const password = String(body?.password ?? "");
  const expected = adminPassword();
  if (!expected || !password || !timingSafeEqualStr(password, expected)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  await createAdminSession();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ authed: await isAdminAuthed() });
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}