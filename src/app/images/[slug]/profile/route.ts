import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { dataUriBuffer } from "@/lib/images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 2 * 60 * 1000;
const CACHE_LIMIT = 64;

type CacheEntry = { mime: string; buf: Buffer; etag: string; lastAccess: number };

const imageCache = new Map<string, CacheEntry>();

function evictIfNeeded() {
  if (imageCache.size < CACHE_LIMIT) return;
  const oldest = imageCache.values().next().value as CacheEntry | undefined;
  if (oldest) {
    for (const [k, v] of imageCache) {
      if (v === oldest) imageCache.delete(k);
    }
  }
}

async function getProfileImage(slug: string): Promise<CacheEntry | null> {
  const now = Date.now();
  const hit = imageCache.get(slug);
  if (hit && now - hit.lastAccess < CACHE_TTL_MS) {
    hit.lastAccess = now;
    return hit;
  }

  const celebrity = await prisma.celebrity.findUnique({
    where: { slug },
    select: { profileImage: true },
  });
  const parsed = dataUriBuffer(celebrity?.profileImage ?? null);
  if (!parsed) return null;

  const etag = createHash("sha1").update(parsed.buffer).digest("hex").slice(0, 24);
  const entry: CacheEntry = { mime: parsed.mime, buf: parsed.buffer, etag, lastAccess: now };
  evictIfNeeded();
  imageCache.set(slug, entry);
  return entry;
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const image = await getProfileImage(slug);
  if (!image) return new NextResponse("Not Found", { status: 404 });

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === `"${image.etag}"`) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(new Uint8Array(image.buf), {
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.buf.length),
      ETag: `"${image.etag}"`,
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "CDN-Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}