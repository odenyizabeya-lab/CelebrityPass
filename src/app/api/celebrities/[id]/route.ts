import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { isAdminAuthed } from "@/lib/auth";
import { getCelebrityBySlug } from "@/lib/services";
import {
  normalizeNameKey,
  imageSha256,
  isUniqueViolation,
  codeForUniqueTarget,
  DUP_CODE,
  type DuplicateCode,
} from "@/lib/dedupe";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const bySlug = await getCelebrityBySlug(id);
  if (bySlug) return NextResponse.json({ celebrity: bySlug });

  const byId = await prisma.celebrity.findUnique({ where: { id } });
  return NextResponse.json({ celebrity: byId }, byId ? { status: 200 } : { status: 404 });
}

/** 409 duplicate response shared by all branches of PATCH. */
function duplicateResponse(message: string, code: DuplicateCode, existing: { id: string; slug: string; name: string }) {
  return NextResponse.json(
    {
      error: code === DUP_CODE.CELEBRITY_EXISTS ? "Celebrity already added" : "Duplicate blocked",
      message,
      code,
      existing,
    },
    { status: 409 },
  );
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const celebrity = await prisma.celebrity.findUnique({ where: { id } });
  if (!celebrity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    const newName = body.name.trim();
    const newNameKey = normalizeNameKey(newName);

    // ── DUPLICATE PREVENTION (6): editing must never collide with another ──
    // celebrity — but MUST keep matching itself cleanly (self-exclusion).
    if (newNameKey !== celebrity.nameKey) {
      const nameDuplicate = await prisma.celebrity.findFirst({
        where: { nameKey: newNameKey, NOT: { id } },
      });
      if (nameDuplicate) {
        return duplicateResponse(
          `${nameDuplicate.name} is already in your CelebrityPass database.`,
          DUP_CODE.CELEBRITY_EXISTS,
          { id: nameDuplicate.id, slug: nameDuplicate.slug, name: nameDuplicate.name },
        );
      }
    }

    data.name = newName;
    data.nameKey = newNameKey;

    // Only resolve the slug from the name when the client did not supply one.
    const submittedSlug = String(body.slug ?? "").trim();
    const newSlug = submittedSlug ? slugify(submittedSlug) : celebrity.slug;
    if (newSlug && newSlug !== celebrity.slug) {
      const slugDuplicate = await prisma.celebrity.findFirst({ where: { slug: newSlug, NOT: { id } } });
      if (slugDuplicate) {
        return duplicateResponse(
          `The URL /${newSlug} is already taken by another celebrity.`,
          DUP_CODE.SLUG_EXISTS,
          { id: slugDuplicate.id, slug: slugDuplicate.slug, name: slugDuplicate.name },
        );
      }
    }
    if (newSlug) data.slug = newSlug;
  }

  // ── Image duplicates on edit ─────────────────────────────────────────────
  // profileImage/coverImage arrive as: undefined (unchanged) | string (new
  // upload) | null (removed). The celebrity's own current image is never a
  // duplicate of itself; any other celebrity already holding the same file is.
  const imageFields = [
    { field: "profileImage", hashField: "profileImageHash" },
    { field: "coverImage", hashField: "coverImageHash" },
  ] as const;
  for (const { field, hashField } of imageFields) {
    if (body[field] === undefined) continue;
    const value = body[field] === null ? null : String(body[field]);
    if (value === null) {
      data[field] = null;
      data[hashField] = null;
      continue;
    }
    const hash = imageSha256(value);
    const ownHash = hashField === "profileImageHash" ? celebrity.profileImageHash : celebrity.coverImageHash;
    if (hash && hash !== ownHash) {
      const dupe = await prisma.celebrity.findFirst({
        where: { [hashField]: hash, NOT: { id } },
      });
      if (dupe) {
        return duplicateResponse("This image has already been added.", DUP_CODE.IMAGE_EXISTS, {
          id: dupe.id,
          slug: dupe.slug,
          name: dupe.name,
        });
      }
    }
    data[field] = value;
    data[hashField] = hash;
  }

  const stringFields = [
    "category",
    "country",
    "city",
    "profession",
    "accentColor",
  ] as const;
  for (const field of stringFields) {
    if (body[field] !== undefined) data[field] = body[field] === null ? null : String(body[field]);
  }
  // The four permanent verified platform URLs. Only fields the client explicitly
  // sent are updated — a stale/empty payload can never wipe verified links.
  const socialUrlFields = ["facebookUrl", "instagramUrl", "tiktokUrl", "googleUrl"] as const;
  for (const field of socialUrlFields) {
    if (body[field] === undefined) continue;
    const v = body[field];
    data[field] = v === null || v === "" ? null : String(v).trim() || null;
  }
  if (body.website !== undefined) data.website = body.website === null ? null : String(body.website);
  if (body.socialLinks !== undefined) data.socialLinks = JSON.stringify(body.socialLinks);
  if (body.cardDesign !== undefined) data.cardDesign = JSON.stringify(body.cardDesign);
  if (body.isFeatured !== undefined) data.isFeatured = Boolean(body.isFeatured);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.isVerified !== undefined) data.isVerified = Boolean(body.isVerified);

  const followerFields = ["instagramFollowers", "tiktokFollowers", "facebookFollowers"] as const;
  const anyFollower = followerFields.some((f) => body[f] !== undefined && body[f] !== null && body[f] !== "");
  for (const field of followerFields) {
    if (body[field] === null || body[field] === "") data[field] = null;
    else if (body[field] !== undefined) data[field] = Number(body[field]);
  }
  if (anyFollower) data.followersUpdatedAt = new Date();

  // ── Database-enforced atomicity: turn any P2002 race into a clean 409 ───
  try {
    const updated = await prisma.celebrity.update({ where: { id }, data });
    return NextResponse.json({ celebrity: updated });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const code: DuplicateCode | null = codeForUniqueTarget((e as { meta?: { target?: unknown } }).meta?.target);
      if (code === DUP_CODE.CELEBRITY_EXISTS || code === DUP_CODE.SLUG_EXISTS || code === DUP_CODE.IMAGE_EXISTS) {
        const nameKey = data.nameKey ? String(data.nameKey) : celebrity.nameKey;
        const duplicate = await prisma.celebrity.findFirst({
          where:
            code === DUP_CODE.SLUG_EXISTS
              ? { slug: { equals: data.slug ? String(data.slug) : celebrity.slug }, NOT: { id } }
              : code === DUP_CODE.IMAGE_EXISTS
                ? {
                    OR: [
                      { profileImageHash: { equals: data.profileImageHash ? String(data.profileImageHash) : undefined } },
                      { coverImageHash: { equals: data.coverImageHash ? String(data.coverImageHash) : undefined } },
                    ],
                    NOT: { id },
                  }
                : { nameKey: { equals: nameKey }, NOT: { id } },
        });
        return duplicateResponse(
          code === DUP_CODE.IMAGE_EXISTS
            ? "This image has already been added."
            : code === DUP_CODE.SLUG_EXISTS
              ? `The URL ${data.slug ? "/" + String(data.slug) : ""} is already taken by another celebrity.`
              : `${duplicate?.name ?? "This celebrity"} is already in your CelebrityPass database.`,
          code,
          duplicate
            ? { id: duplicate.id, slug: duplicate.slug, name: duplicate.name }
            : { id: celebrity.id, slug: celebrity.slug, name: celebrity.name },
        );
      }
    }
    throw e;
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.celebrity.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.celebrity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}