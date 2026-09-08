import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { storeUploadedMedia, MediaValidationError } from "@/lib/social/media";
import { makeRateLimiter } from "@/lib/secure";

export const dynamic = "force-dynamic";

const uploadLimiter = makeRateLimiter(30, 60_000);

// GET /api/social/admin/media — list uploaded assets (metadata only).
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = 50;
  const assets = await prisma.socialMediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, storage: true, platformKey: true, createdAt: true },
  });
  return NextResponse.json({ assets });
}

// POST /api/social/admin/media
//   body: { fileName?, mimeType?, base64?, url?, platformKey? }
export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!uploadLimiter("media-upload")) {
    return NextResponse.json({ error: "Upload rate limit reached. Try again shortly." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const id = await storeUploadedMedia({
      fileName: typeof body.fileName === "string" ? body.fileName : undefined,
      mimeType: typeof body.mimeType === "string" ? body.mimeType : undefined,
      base64: typeof body.base64 === "string" ? body.base64 : undefined,
      url: typeof body.url === "string" ? body.url : undefined,
      platformKey: typeof body.platformKey === "string" ? body.platformKey : undefined,
    });
    return NextResponse.json({ ok: true, assetId: id });
  } catch (e) {
    if (e instanceof MediaValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to store media." }, { status: 500 });
  }
}