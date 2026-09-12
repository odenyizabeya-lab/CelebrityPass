/**
 * Small image helpers used to serve celebrity profile photos from the DB
 * (stored as base64 data URIs) as real, cacheable, optimizable URLs.
 */

const DIMS_CACHE_LIMIT = 128;
const dimsCache = new Map<string, { w: number; h: number }>();
let imageFlagsCache: { flags: Map<string, { hasProfile: boolean; hasCover: boolean }>; expires: number } | null = null;

// In-process byte caches for the /images/[slug]/profile|cover routes. They live
// here (not inside the route files) so admin write routes can invalidate a
// changed/deleted photo immediately — the old bytes must never outlive an edit.
const MEDIA_CACHE_TTL_MS = 2 * 60 * 1000;
const MEDIA_CACHE_LIMIT = 64;
export type CelebrityMediaEntry = { mime: string; buf: Buffer; etag: string; lastAccess: number };

export const profileImageMemory = new Map<string, CelebrityMediaEntry>();
export const coverImageMemory = new Map<string, CelebrityMediaEntry>();

/** Stores a decoded image byte entry, evicting the oldest when over the limit. */
export function cacheMedia(cache: Map<string, CelebrityMediaEntry>, slug: string, entry: CelebrityMediaEntry) {
  if (cache.size >= MEDIA_CACHE_LIMIT) {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [k, v] of cache) {
      if (v.lastAccess < oldestAt) {
        oldestAt = v.lastAccess;
        oldestKey = k;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(slug, entry);
}

export function mediaCacheHits(cache: Map<string, CelebrityMediaEntry>, slug: string, now: number): CelebrityMediaEntry | null {
  const hit = cache.get(slug);
  if (hit && now - hit.lastAccess < MEDIA_CACHE_TTL_MS) {
    hit.lastAccess = now;
    return hit;
  }
  return null;
}

/**
 * Drops every in-process celebrity media cache so an admin edit/delete is
 * visible on the very next request (no stale photos or presence flags).
 */
export function invalidateCelebrityMedia() {
  profileImageMemory.clear();
  coverImageMemory.clear();
  dimsCache.clear();
  imageFlagsCache = null;
}

import { prisma } from "./db";

function dimsKey(uri: string): string {
  return `${uri.length}:${uri.slice(0, 96)}`;
}

function memoDims(uri: string, dims: { w: number; h: number } | null) {
  if (!dims) return null;
  if (dimsCache.size >= DIMS_CACHE_LIMIT) {
    const first = dimsCache.keys().next().value;
    if (first) dimsCache.delete(first);
  }
  dimsCache.set(dimsKey(uri), dims);
  return dims;
}

function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

function pngDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function jpegDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 4) return null;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let o = 2;
  while (o + 9 < buf.length) {
    if (buf[o] !== 0xff) {
      o += 1;
      continue;
    }
    const marker = buf[o + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      o += 2;
      continue;
    }
    const len = buf.readUInt16BE(o + 2);
    if (len < 2) return null;
    o += 2 + len;
  }
  return null;
}

function svgDims(svg: string): { w: number; h: number } | null {
  const m = /viewBox\s*=\s*["'][\s\S]*?([\d.]+)[\s,]+([\d.]+)["']/i.exec(svg);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w: Math.round(w), h: Math.round(h) };
}

/**
 * Returns the decoded bytes + mime type of a data URI, or null. Handles both
 * base64 payloads (profile photos) and URL-encoded payloads (SVG covers).
 */
export function dataUriBuffer(uri: string | null): { mime: string; buffer: Buffer } | null {
  if (!uri) return null;

  const b64 = /^data:image\/([a-z+.-]+);base64,([\s\S]*)$/i.exec(uri);
  if (b64 && b64[2]) {
    return { mime: `image/${b64[1]}`, buffer: base64ToBuffer(b64[2]) };
  }

  const encoded = /^data:image\/([a-z+.-]+)(?:;[a-z0-9-]+=[a-z0-9-]+)?,([\s\S]*)$/i.exec(uri);
  if (encoded && encoded[2]) {
    try {
      const text = decodeURIComponent(encoded[2]);
      return { mime: `image/${encoded[1]}`, buffer: Buffer.from(text, "utf8") };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Reads just enough of a data URI to know its pixel dimensions. Cheap (header
 * parse only) and memoized, so it can be called on every render.
 */
export function dataUriDims(uri: string | null): { w: number; h: number } | null {
  if (!uri) return null;
  const key = dimsKey(uri);
  const cached = dimsCache.get(key);
  if (cached) return cached;

  const m = /^data:image\/([a-z+]+);/.exec(uri);
  if (!m || !m[1]) return null;

  const isSvg = m[1] === "svg+xml";
  if (isSvg) {
    let svg = uri.split(",", 2)[1] ?? "";
    if (!svg) return null;
    if (uri.startsWith("data:image/svg+xml;base64,")) {
      svg = base64ToBuffer(svg).toString("utf8");
    } else {
      try {
        svg = decodeURIComponent(svg);
      } catch {
        svg = svg;
      }
    }
    return memoDims(uri, svgDims(svg));
  }

  const buf = dataUriBuffer(uri);
  if (!buf) return null;
  const dims = m[1] === "png" ? pngDims(buf.buffer) : m[1] === "jpeg" || m[1] === "jpg" ? jpegDims(buf.buffer) : null;
  return memoDims(uri, dims);
}

/** Canonical, cacheable URL that serves a celebrity's profile photo. */
export function profileImageUrl(slug: string, dataUri: string | null): string | null {
  if (!dataUri) return null;
  return `/images/${slug}/profile`;
}

/**
 * Photo presence flags for every celebrity WITHOUT transferring the image
 * bytes. Reading the giant base64 `profileImage`/`coverImage` columns in list
 * queries makes pages take tens of seconds over the network, so user-facing
 * queries fetch only these 0/1 flags and then point at the cacheable routes.
 */
export async function celebrityImageFlags(): Promise<Map<string, { hasProfile: boolean; hasCover: boolean }>> {
  const hit = imageFlagsCache;
  const now = Date.now();
  if (hit && hit.expires > now) return hit.flags;
  const rows = await prisma.$queryRaw<{ slug: string; has_profile: boolean; has_cover: boolean }[]>`
    SELECT "slug",
           ("profileImage" IS NOT NULL AND "profileImage" <> '') AS has_profile,
           ("coverImage"   IS NOT NULL AND "coverImage"   <> '') AS has_cover
    FROM "Celebrity"`;
  const flags = new Map<string, { hasProfile: boolean; hasCover: boolean }>();
  for (const r of rows) flags.set(r.slug, { hasProfile: r.has_profile, hasCover: r.has_cover });
  imageFlagsCache = { flags, expires: now + 45_000 };
  return flags;
}