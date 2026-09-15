import { NextResponse, type NextRequest } from "next/server";
import { searchCommunityByImage } from "@/lib/ai/scanner";

export const dynamic = "force-dynamic";
// One Gemini vision call (up to ~55s internally) plus a DB lookup — keep the
// platform's serverless ceiling so a slow grounding/vision day can't 504 it.
export const maxDuration = 300;

// POST /api/celebrities/visual-search  body: { image: "<data URI>" }
// Real visual search: the photo is sent to Gemini vision to identify WHO is in
// the picture, then matched against the CelebrityPass community database. If
// the subject isn't recognized (or has no community yet), the API says so
// honestly instead of pretending.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.image !== "string" || !/^data:image\//.test(body.image)) {
    return NextResponse.json({ error: "A valid image is required" }, { status: 400 });
  }

  const outcome = await searchCommunityByImage(body.image);
  if (outcome.status === "provider_error") {
    return NextResponse.json({ outcome }, { status: 502 });
  }
  return NextResponse.json({ outcome });
}