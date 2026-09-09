// POST /api/admin/ai/scan — run the Automatic Celebrity Scanner on an image.
//   body: { imageDataUri: string, includeEvents?: boolean }
// Returns the prepared payload for admin review. Performs NO writes.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { runCelebrityScan } from "@/lib/ai/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const imageDataUri = typeof body?.imageDataUri === "string" ? body.imageDataUri.trim() : "";

  if (!imageDataUri) {
    return NextResponse.json({ error: "Upload a celebrity photo before scanning." }, { status: 400 });
  }
  if (!/^data:image\//.test(imageDataUri)) {
    return NextResponse.json({ error: "The file must be an image (JPG/PNG/WebP)." }, { status: 400 });
  }

  try {
    const outcome = await runCelebrityScan(imageDataUri, { includeEvents: body?.includeEvents === true });

    if (outcome.status === "low_confidence") {
      return NextResponse.json({
        status: "low_confidence",
        message: outcome.identity.reason || "Could not confidently identify who this is. Upload a clearer, well-lit photo of the person's face.",
        identity: outcome.identity,
      });
    }
    if (outcome.status === "provider_error") {
      return NextResponse.json({ status: "provider_error", message: outcome.message, detail: outcome.detail }, { status: 502 });
    }
    return NextResponse.json({ status: "ok", result: outcome.result });
  } catch (e) {
    return NextResponse.json(
      { status: "provider_error", message: `Scan failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}