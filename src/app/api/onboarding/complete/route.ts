// POST /api/onboarding/complete — marks the app-welcome experience as complete
// for this visitor by setting a persistent httpOnly cookie.
import { NextResponse } from "next/server";
import { markOnboarded } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export async function POST() {
  await markOnboarded();
  return NextResponse.json({ ok: true });
}