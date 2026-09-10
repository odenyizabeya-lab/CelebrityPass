import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { slugify, avatarDataUri, coverDataUri } from "@/lib/utils";
import { defaultFollowerCounts } from "@/lib/followers";
import { getCelebritySummaries } from "@/lib/services";
import { isAdminAuthed } from "@/lib/auth";
import { fetchGoogleInfo } from "@/lib/google-info";
import { assignFanNumber, fameTier, maxFollowers } from "@/lib/fame";
import { FANS_BIG_MIN } from "@/lib/display";
import {
  normalizeNameKey,
  imageSha256,
  isUniqueViolation,
  codeForUniqueTarget,
  DUP_CODE,
  type DuplicateCode,
} from "@/lib/dedupe";
import { sendNewCelebrityAnnouncement } from "@/lib/emails/senders";

export const dynamic = "force-dynamic";

// GET ?search=&category=&country=&profession=
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const filters = {
    search: sp.get("search") ?? undefined,
    category: sp.get("category") ?? undefined,
    country: sp.get("country") ?? undefined,
    profession: sp.get("profession") ?? undefined,
    includeInactive: sp.get("includeInactive") === "true",
  };
  const celebrities = await getCelebritySummaries(filters);
  return NextResponse.json({ celebrities });
}

// POST create a celebrity (admin)
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  let slug = slugify(String(body.slug ?? "")) || slugify(name);
  if (!slug) return NextResponse.json({ error: "Invalid name for slug" }, { status: 400 });

  // ── DUPLICATE PREVENTION (1): celebrity name ─────────────────────────────
  // Case/space/punctuation-insensitive. "Tom Cruise" == "tom cruise" == "TOM".
  const nameKey = normalizeNameKey(name);
  if (!nameKey) return NextResponse.json({ error: "Invalid celebrity name" }, { status: 400 });
  const nameDuplicate = await prisma.celebrity.findFirst({ where: { nameKey } });
  if (nameDuplicate) {
    return NextResponse.json(
      {
        error: "Celebrity already added",
        message: `${nameDuplicate.name} is already in your CelebrityPass database.`,
        code: DUP_CODE.CELEBRITY_EXISTS,
        existing: { id: nameDuplicate.id, slug: nameDuplicate.slug, name: nameDuplicate.name },
      },
      { status: 409 },
    );
  }

  const existing = await prisma.celebrity.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const category = String(body.category ?? "Public Figure");
  const accentColor = String(body.accentColor ?? "#8b5cf6");

  // Auto-build everything for a brand-new celebrity: photos, follower counts.
  const userProfileImage = body.profileImage ? String(body.profileImage) : null;
  const userCoverImage = body.coverImage ? String(body.coverImage) : null;
  const profileImage = userProfileImage ?? avatarDataUri(name, accentColor);
  const coverImage = userCoverImage ?? coverDataUri(accentColor);

  // ── DUPLICATE PREVENTION (3): exact image duplicates ─────────────────────
  // SHA-256 of the uploaded bytes. Only user-uploaded images are fingerprinted;
  // auto-generated initials/cover art can be shared freely.
  const profileImageHash = userProfileImage ? imageSha256(userProfileImage) : null;
  const coverImageHash = userCoverImage ? imageSha256(userCoverImage) : null;
  if (profileImageHash) {
    const dupe = await prisma.celebrity.findFirst({ where: { profileImageHash } });
    if (dupe) {
      return NextResponse.json(
        {
          error: "Image already added",
          message: "This image has already been added.",
          code: DUP_CODE.IMAGE_EXISTS,
          existing: { id: dupe.id, slug: dupe.slug, name: dupe.name },
        },
        { status: 409 },
      );
    }
  }
  if (coverImageHash) {
    const dupe = await prisma.celebrity.findFirst({ where: { coverImageHash } });
    if (dupe) {
      return NextResponse.json(
        {
          error: "Image already added",
          message: "This image has already been added.",
          code: DUP_CODE.IMAGE_EXISTS,
          existing: { id: dupe.id, slug: dupe.slug, name: dupe.name },
        },
        { status: 409 },
      );
    }
  }

  const numbers = defaultFollowerCounts(category, name);
  const instagramFollowers =
    body.instagramFollowers !== undefined && body.instagramFollowers !== "" && body.instagramFollowers !== null
      ? Number(body.instagramFollowers)
      : numbers.instagramFollowers;
  const tiktokFollowers =
    body.tiktokFollowers !== undefined && body.tiktokFollowers !== "" && body.tiktokFollowers !== null
      ? Number(body.tiktokFollowers)
      : numbers.tiktokFollowers;
  const facebookFollowers =
    body.facebookFollowers !== undefined && body.facebookFollowers !== "" && body.facebookFollowers !== null
      ? Number(body.facebookFollowers)
      : numbers.facebookFollowers;

  // ── DUPLICATE PREVENTION (5): database-enforced atomicity ────────────────
  // Unique constraints on nameKey/slug/image hashes are the last line of
  // defense — even two simultaneous requests that both pass the checks above
  // cannot both insert (P2002), and this try/catch turns that into a clean 409.
  let celebrity;
  try {
    celebrity = await prisma.celebrity.create({
      data: {
        slug,
        nameKey,
        name,
        category,
        country: String(body.country ?? ""),
        city: body.city ? String(body.city) : null,
        profession: String(body.profession ?? ""),
        profileImage,
        profileImageHash,
        coverImage,
        coverImageHash,
        accentColor,
        isFeatured: Boolean(body.isFeatured ?? false),
        isActive: Boolean(body.isActive ?? true),
        isVerified: true,
        socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
        // Permanent verified official platform links — stored in dedicated columns.
        facebookUrl: body.facebookUrl ? String(body.facebookUrl) : null,
        instagramUrl: body.instagramUrl ? String(body.instagramUrl) : null,
        tiktokUrl: body.tiktokUrl ? String(body.tiktokUrl) : null,
        googleUrl: body.googleUrl ? String(body.googleUrl) : null,
        cardDesign: body.cardDesign ? JSON.stringify(body.cardDesign) : null,
        website: body.website ? String(body.website) : null,
        instagramFollowers: instagramFollowers ?? null,
        tiktokFollowers: tiktokFollowers ?? null,
        facebookFollowers: facebookFollowers ?? null,
        followersUpdatedAt: new Date(),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const target = (e as { meta?: { target?: unknown } }).meta?.target;
      const code: DuplicateCode | null = codeForUniqueTarget(target) ?? DUP_CODE.CELEBRITY_EXISTS;
      const duplicate = await prisma.celebrity.findFirst({
        where:
          code === DUP_CODE.SLUG_EXISTS
            ? { slug }
            : code === DUP_CODE.IMAGE_EXISTS
              ? { OR: [{ profileImageHash: profileImageHash ?? undefined }, { coverImageHash: coverImageHash ?? undefined }] }
              : { nameKey: { equals: nameKey } },
      });
      const message =
        code === DUP_CODE.IMAGE_EXISTS
          ? "This image has already been added."
          : code === DUP_CODE.SLUG_EXISTS
            ? `The URL /${slug} is already taken by another celebrity.`
            : `${name} is already in your CelebrityPass database.`;
      return NextResponse.json(
        {
          error: code === DUP_CODE.CELEBRITY_EXISTS ? "Celebrity already added" : "Duplicate blocked",
          message,
          code,
          existing: duplicate ? { id: duplicate.id, slug: duplicate.slug, name: duplicate.name } : undefined,
        },
        { status: 409 },
      );
    }
    throw e;
  }

  // Assign the celebrity's unique Registered Fans figure right away based on
  // what we already know. The Google knowledge panel (fetched in the background
  // below) may later reveal the celebrity is famous enough to move up a tier.
  const maxF = maxFollowers({ instagramFollowers, tiktokFollowers, facebookFollowers });
  await assignFanNumber(celebrity.id, celebrity.slug, fameTier(null, maxF));

  // Notify fans who opted into "New celebrity added" updates. A real, curated
  // customer-facing announcement — never fires for ordinary edits.
  void sendNewCelebrityAnnouncement({
    id: celebrity.id,
    slug: celebrity.slug,
    name: celebrity.name,
    category: celebrity.category,
  }).catch((err) => console.error("[email] New-celebrity announcement failed:", err));

  // Auto-populate the Google-style knowledge panel for a NEW celebrity in the
  // background (never blocks the create response). If lookups fail, the profile
  // falls back to its own bio — nothing is ever fabricated. When the panel
  // shows a genuinely big public figure, its fan number moves up to the big
  // tier (1M–5M).
  const celebId = celebrity.id;
  const celebSlug = celebrity.slug;
  const celebName = celebrity.name;
  void (async () => {
    try {
      const info = await fetchGoogleInfo(celebName, {
        profession: celebrity.profession,
        category: celebrity.category,
      });
      const panelTier = fameTier(info, maxF);
      if (panelTier === "big") {
        const current = await prisma.celebrity.findUnique({
          where: { id: celebId },
          select: { displayFanCount: true },
        });
        if ((current?.displayFanCount ?? 0) < FANS_BIG_MIN) {
          await assignFanNumber(celebId, celebSlug, "big");
        }
      }
      if (info) {
        await prisma.celebrity.update({
          where: { id: celebId },
          data: { googleInfo: JSON.stringify(info) },
        });
      }
    } catch {
      /* ignored — keep the admin flow fast and safe */
    }
  })();

  return NextResponse.json({ celebrity: { id: celebrity.id, slug: celebrity.slug } }, { status: 201 });
}