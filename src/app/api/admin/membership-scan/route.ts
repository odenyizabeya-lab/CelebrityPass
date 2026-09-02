import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { scanMembershipForPhoto } from "@/lib/ai/scanner";

export const dynamic = "force-dynamic";

// POST /api/admin/membership-scan — send the celebrity's photo and get back a
// recommended community membership level (name, description, benefits, price).
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const image = typeof body?.image === "string" && body.image.length ? body.image : null;
  if (!image) {
    return NextResponse.json({ error: "No image was provided to scan." }, { status: 400 });
  }

  const result = await scanMembershipForPhoto(image);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, hint: result.hint }, { status: 422 });
  }
  return NextResponse.json({ ok: true, data: result.data });
}