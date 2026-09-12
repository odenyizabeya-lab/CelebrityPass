import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { dataUriBuffer, profileImageMemory, cacheMedia, mediaCacheHits, type CelebrityMediaEntry } from "@/lib/images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getProfileImage(slug: string): Promise<
  | { kind: "bytes"; entry: CelebrityMediaEntry }
  | { kind: "redirect"; url: string }
  | null
> {
  const now = Date.now();
  const hit = mediaCacheHits(profileImageMemory, slug, now);
  if (hit) return { kind: "bytes", entry: hit };

  const celebrity = await prisma.celebrity.findUnique({
    where: { slug },
    select: { profileImage: true },
  });
  const uri = celebrity?.profileImage ?? null;
  // External http(s) images are proxied via a 307 so browsers/clients render
  // them without us having to downscale or whitelist the source.
  if (uri && /^https?:\/\//i.test(uri)) return { kind: "redirect", url: uri };

  const parsed = dataUriBuffer(uri);
  if (!parsed) return null;

  const etag = createHash("sha1").update(parsed.buffer).digest("hex").slice(0, 24);
  const entry: CelebrityMediaEntry = { mime: parsed.mime, buf: parsed.buffer, etag, lastAccess: now };
  cacheMedia(profileImageMemory, slug, entry);
  return { kind: "bytes", entry };
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const image = await getProfileImage(slug);
  if (!image) return new NextResponse("Not Found", { status: 404 });
  if (image.kind === "redirect") {
    return NextResponse.redirect(image.url, {
      status: 307,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        "CDN-Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  }

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === `"${image.entry.etag}"`) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(new Uint8Array(image.entry.buf), {
    headers: {
      "Content-Type": image.entry.mime,
      "Content-Length": String(image.entry.buf.length),
      ETag: `"${image.entry.etag}"`,
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "CDN-Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}