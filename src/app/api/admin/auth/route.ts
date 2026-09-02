import { NextResponse, type NextRequest } from "next/server";
import { createAdminSession, isAdminAuthed, clearAdminSession } from "@/lib/auth";
import { timingSafeEqualStr } from "@/lib/secure";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = String(body?.password ?? "");
  const expected = process.env.ADMIN_PASSWORD || "FancardAdmin2026!";
  if (!password || !timingSafeEqualStr(password, expected)) {
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