import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { verifyPanelImageSig } from "@/lib/panel-image-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_LIMIT = 200;

type ExtEntry = { mime: string; buf: Buffer; etag: string; lastAccess: number };
const extMemory = new Map<string, ExtEntry>();

function cacheHit(key: string, now: number): ExtEntry | null {
  const hit = extMemory.get(key);
  if (hit && now - hit.lastAccess < CACHE_TTL_MS) {
    hit.lastAccess = now;
    return hit;
  }
  return null;
}

function cacheSet(key: string, entry: ExtEntry) {
  if (extMemory.size >= CACHE_LIMIT) {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [k, v] of extMemory) {
      if (v.lastAccess < oldestAt) {
        oldestAt = v.lastAccess;
        oldestKey = k;
      }
    }
    if (oldestKey) extMemory.delete(oldestKey);
  }
  extMemory.set(key, entry);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!verifyPanelImageSig(url.searchParams)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const upstream = url.searchParams.get("u")!;
  const now = Date.now();
  const hit = cacheHit(upstream, now);
  if (hit) {
    return imageResponse(hit.mime, hit.etag, hit.buf, request);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(upstream, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });
  } catch {
    return new NextResponse("Upstream fetch failed", { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return new NextResponse("Not an image", { status: 502 });
  }
  const contentLength = Number(res.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BYTES) return new NextResponse("Too large", { status: 502 });

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return new NextResponse("Not an image", { status: 502 });
  }
  const mime = contentType.split(";")[0] || "image/jpeg";
  const etag = createHash("sha1").update(buf).digest("hex").slice(0, 24);
  cacheSet(upstream, { mime, buf, etag, lastAccess: now });

  return imageResponse(mime, etag, buf, request);
}

function imageResponse(mime: string, etag: string, buf: Buffer, request: Request) {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === `"${etag}"`) {
    return new NextResponse(null, { status: 304 });
  }
  // Cache-Control: long-lived; the bytes are immutable upstream (Wikimedia/Deezer
  // image URLs never change), so browsers + CDN can hold them hard.
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.length),
      ETag: `"${etag}"`,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      "CDN-Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}