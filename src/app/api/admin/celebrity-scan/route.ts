import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { scanCelebrityImage } from "@/lib/ai/scanner";

export const dynamic = "force-dynamic";

// POST /api/admin/celebrity-scan — send an uploaded celebrity photo to the AI
// scanner and get back the auto-filled form fields.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const image = typeof body?.image === "string" && body.image.length ? body.image : null;
  if (!image) {
    return NextResponse.json({ error: "No image was provided to scan." }, { status: 400 });
  }

  const result = await scanCelebrityImage(image);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, hint: result.hint }, { status: 422 });
  }
  return NextResponse.json({ ok: true, data: result.data });
}