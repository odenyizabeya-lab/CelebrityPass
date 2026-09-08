/**
 * Media helpers for the social publishing system.
 *
 * Media is stored either as inline data-URIs in the `SocialMediaAsset` table
 * (db storage — same pattern the rest of the platform uses for images) or as
 * external URLs. Uploaded payloads are size-capped before storage.
 */

import { prisma } from "@/lib/db";
import type { SocialMediaRef } from "./types";

export const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50 MB per asset (cap)
export const ALLOWED_MIME_PREFIXES = ["image/", "video/"];

/** Basic validation-issued error for oversized/unsupported uploads. */
export class MediaValidationError extends Error {}

/**
 * Store an uploaded media file. `base64` may include a `data:` URI scheme or
 * be raw base64. Returns the newly created asset id.
 */
export async function storeUploadedMedia(input: {
  fileName?: string;
  mimeType?: string;
  base64?: string;
  url?: string;
  platformKey?: string;
}): Promise<string> {
  if (input.url && !input.base64) {
    const asset = await prisma.socialMediaAsset.create({
      data: {
        fileName: input.fileName ?? null,
        mimeType: input.mimeType ?? null,
        storage: "url",
        url: input.url,
        platformKey: input.platformKey ?? null,
      },
    });
    return asset.id;
  }

  const raw = input.base64 ?? "";
  const mime = input.mimeType ?? guessMime(raw, input.fileName);

  if (!mime || !ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
    throw new MediaValidationError("Unsupported media type. Use an image or video file.");
  }

  const dataUri = raw.startsWith("data:") ? raw : `data:${mime};base64,${raw}`;
  const sizeBytes = Buffer.from(raw.split(",").pop() ?? "", "base64").length;
  if (sizeBytes > MAX_MEDIA_BYTES) {
    throw new MediaValidationError("Media file is too large. Maximum size is 50 MB.");
  }

  const asset = await prisma.socialMediaAsset.create({
    data: {
      fileName: input.fileName ?? null,
      mimeType: mime,
      sizeBytes,
      storage: "db",
      dataUri,
      platformKey: input.platformKey ?? null,
    },
  });
  return asset.id;
}

/** Resolve stored asset ids to concrete media references for publish payloads. */
export async function resolveMediaRefs(items: SocialMediaRef[]): Promise<SocialMediaRef[]> {
  const out: SocialMediaRef[] = [];
  for (const item of items) {
    if (item.assetId) {
      const asset = await prisma.socialMediaAsset.findUnique({ where: { id: item.assetId } });
      if (!asset) continue;
      out.push({
        url: asset.dataUri ?? asset.url ?? undefined,
        mimeType: asset.mimeType ?? undefined,
        name: asset.fileName ?? undefined,
        sizeBytes: asset.sizeBytes ?? undefined,
      });
    } else if (item.url) {
      out.push(item);
    }
  }
  return out;
}

/** Guess a mime type from a base64 prefix or file name. */
function guessMime(base64: string, fileName?: string): string | null {
  if (base64.startsWith("data:")) {
    const m = base64.match(/^data:([^;]+);/);
    if (m) return m[1];
  }
  const ext = (fileName ?? "").toLowerCase().split(".").pop();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    default:
      return null;
  }
}

/**
 * Convert a data-URI to a Uint8Array. Used when a platform requires raw binary
 * upload (e.g. TikTok storage upload). Respects any platform URL ref too.
 */
export async function fetchMediaBytes(ref: SocialMediaRef): Promise<{
  bytes: Uint8Array;
  mimeType: string | null;
  name: string | null;
} | null> {
  const url = ref.url;
  const mimeType = ref.mimeType ?? null;
  if (!url) return null;
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    if (comma < 0) return null;
    const headers = url.slice(5, comma);
    const mime = headers.split(";")[0] || mimeType;
    return { bytes: Uint8Array.from(atobSafe(url.slice(comma + 1))), mimeType: mime, name: ref.name ?? null };
  }
  try {
    const res = await fetch(url, { headers: { "User-Agent": "KCO/1.0" } });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return { bytes: buf, mimeType: res.headers.get("content-type") ?? mimeType, name: ref.name ?? null };
  } catch {
    return null;
  }
}

/** atob replacement that works in Workers + Node (no global atob dependency). */
function atobSafe(b64: string): Uint8Array {
  const binary = Buffer.from(b64, "base64");
  return new Uint8Array(binary);
}