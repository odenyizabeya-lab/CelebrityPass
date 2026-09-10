import crypto from "crypto";
import { dataUriBuffer } from "./images";

/**
 * Canonical, case/space/punctuation-insensitive key for a celebrity name.
 * "Tom Cruise", "tom cruise", " TOM   CRUISE! " and "Tom-Cruise" all produce
 * the same key, so the same person can never be added twice under cosmetic
 * variations. Diacritics are stripped so "Beyoncé" and "Beyonce" match.
 *
 * This function is the single source of truth; the DB stores/backfills the
 * same value in `Celebrity.nameKey` (unique).
 */
export function normalizeNameKey(name: string): string {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * SHA-256 fingerprint of an uploaded image's raw bytes. Two identical files
 * (same bytes) always yield the same hash and are rejected before save.
 * Returns null when the value is not a decodable image data URI.
 */
export function imageSha256(dataUri: string | null | undefined): string | null {
  if (!dataUri || typeof dataUri !== "string") return null;
  const parsed = dataUriBuffer(dataUri);
  if (!parsed) return null;
  return crypto.createHash("sha256").update(parsed.buffer).digest("hex");
}

/** Machine-readable duplicate reason codes used by the admin UI. */
export const DUP_CODE = {
  CELEBRITY_EXISTS: "CELEBRITY_EXISTS",
  IMAGE_EXISTS: "IMAGE_EXISTS",
  SLUG_EXISTS: "SLUG_EXISTS",
} as const;

export type DuplicateCode = (typeof DUP_CODE)[keyof typeof DUP_CODE];

export type ExistingCelebrityRef = { id: string; slug: string; name: string };

/** True when a Prisma error is a unique-constraint violation. */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/** Map a P2002 meta target back to a friendly duplicate code. */
export function codeForUniqueTarget(target: unknown): DuplicateCode | null {
  const t = Array.isArray(target) ? target.join("_") : String(target ?? "");
  if (t.includes("nameKey")) return DUP_CODE.CELEBRITY_EXISTS;
  if (t.includes("ImageHash")) return DUP_CODE.IMAGE_EXISTS;
  if (t.includes("slug")) return DUP_CODE.SLUG_EXISTS;
  return null;
}