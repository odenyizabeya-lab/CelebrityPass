import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { isAdminAuthed } from "@/lib/auth";
import { getCelebrityBySlug, clearReadCache } from "@/lib/services";
import { invalidateCelebrityMedia } from "@/lib/images";
import { revalidateCelebrityPages } from "@/lib/revalidate";
import {
  normalizeNameKey,
  imageSha256,
  isUniqueViolation,
  codeForUniqueTarget,
  DUP_CODE,
  type DuplicateCode,
} from "@/lib/dedupe";
import { normalizeSocialUrl, type SocialPlatform } from "@/lib/social/resolve";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  // Raw base64 image columns must never cross the server→client boundary
  // (multi-megabyte JSON payloads); only the cacheable image routes are public.
  const bySlug = await getCelebrityBySlug(id);
  if (bySlug) {
    const { profileImage, coverImage, ...publicCelebrity } = bySlug;
    void profileImage;
    void coverImage;
    return NextResponse.json({ celebrity: publicCelebrity });
  }

  const byId = await prisma.celebrity.findUnique({ where: { id } });
  if (!byId) return NextResponse.json({ celebrity: null }, { status: 404 });
  const { profileImage, coverImage, ...publicById } = byId;
  void profileImage;
  void coverImage;
  return NextResponse.json({ celebrity: publicById }, { status: 200 });
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
  // Admin-written biography paragraph (shown at the top of the public page).
  if (body.bio !== undefined) {
    data.bio = body.bio === null || String(body.bio).trim() === "" ? null : String(body.bio).trim();
  }
  // The four permanent verified platform URLs. Only fields the client explicitly
  // sent are updated — a stale/empty payload can never wipe verified links —
  // and every value is normalized so junk/placeholder/guessed links are stored
  // as null: nothing unverified can ever render as a link.
  const socialUrlFields = [
    ["facebookUrl", "facebook"],
    ["instagramUrl", "instagram"],
    ["tiktokUrl", "tiktok"],
    ["googleUrl", "google"],
  ] as const;
  for (const [field, platform] of socialUrlFields) {
    if (body[field] === undefined) continue;
    const v = body[field];
    const raw = v === null || v === "" ? null : String(v).trim() || null;
    data[field] = normalizeSocialUrl(platform as SocialPlatform, raw);
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
    // The edit must be live on the very next request: clear in-process read and
    // image caches, then revalidate every page that could list this celebrity —
    // the old slug too, in case the edit changed the URL.
    clearReadCache();
    invalidateCelebrityMedia();
    revalidateCelebrityPages(celebrity.slug);
    if (data.slug && String(data.slug) !== celebrity.slug) revalidateCelebrityPages(String(data.slug));
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
  const existing = await prisma.celebrity.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Safety check before any destructive action (related-data review) ─────
  // Every child table cascades (levels, fan cards, selections, events, chat) or
  // nulls its reference (payments, announcements, social articles) EXCEPT one:
  // TicketOrder.event is ON DELETE RESTRICT because real bookings must stay on
  // record. So a community with paid event bookings can never be deleted.
  const [membershipCount, fanCardCount, eventCount, ticketOrderCount] = await Promise.all([
    prisma.membershipLevel.count({ where: { celebrityId: id } }),
    prisma.fanCard.count({ where: { celebrityId: id } }),
    prisma.celebrityEvent.count({ where: { celebrityId: id } }),
    prisma.ticketOrder.count({ where: { event: { celebrityId: id } } }),
  ]);

  if (ticketOrderCount > 0) {
    return NextResponse.json(
      {
        error:
          `${existing.name} cannot be deleted: this community has ${ticketOrderCount} paid event booking(s). ` +
          "Real ticket orders must stay on record, so the community (and its events) are kept.",
        code: "BLOCKED_BY_TICKET_ORDERS",
        related: { memberships: membershipCount, fanCards: fanCardCount, events: eventCount, ticketOrders: ticketOrderCount },
      },
      { status: 409 },
    );
  }

  // A booking could race in between the count above and the delete — the FK
  // violation then turns into the same clean, honest 409 instead of a 500.
  try {
    await prisma.celebrity.delete({ where: { id } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2003") {
      return NextResponse.json(
        {
          error:
            `${existing.name} cannot be deleted: related ticket/event records exist. ` +
            "These must stay on record, so the community is kept.",
          code: "BLOCKED_BY_RELATED_RECORDS",
        },
        { status: 409 },
      );
    }
    throw e;
  }

  // The removal must be live immediately: clear in-process read/image caches
  // and revalidate every page that could still reference this slug — its own
  // profile must 404 on the next request, not after up to 60s of ISR staleness.
  clearReadCache();
  invalidateCelebrityMedia();
  revalidateCelebrityPages(existing.slug);

  return NextResponse.json({
    ok: true,
    deleted: existing,
    removed: { memberships: membershipCount, fanCards: fanCardCount, events: eventCount, ticketOrders: ticketOrderCount },
  });
}