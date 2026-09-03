import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { slugify, avatarDataUri, coverDataUri } from "@/lib/utils";
import { defaultFollowerCounts } from "@/lib/followers";
import { getCelebritySummaries } from "@/lib/services";
import { isAdminAuthed } from "@/lib/auth";

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

  const existing = await prisma.celebrity.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const category = String(body.category ?? "Public Figure");
  const accentColor = String(body.accentColor ?? "#8b5cf6");

  // Auto-build everything for a brand-new celebrity: photos, follower counts.
  const profileImage = body.profileImage ? String(body.profileImage) : avatarDataUri(name, accentColor);
  const coverImage = body.coverImage ? String(body.coverImage) : coverDataUri(accentColor);

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

  const celebrity = await prisma.celebrity.create({
    data: {
      slug,
      name,
      category,
      country: String(body.country ?? ""),
      city: body.city ? String(body.city) : null,
      profession: String(body.profession ?? ""),
      bio: String(body.bio ?? ""),
      shortBio: body.shortBio ? String(body.shortBio) : null,
      profileImage,
      coverImage,
      accentColor,
      isFeatured: Boolean(body.isFeatured ?? false),
      isActive: Boolean(body.isActive ?? true),
      isVerified: Boolean(body.isVerified ?? false),
      socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
      cardDesign: body.cardDesign ? JSON.stringify(body.cardDesign) : null,
      website: body.website ? String(body.website) : null,
      instagramFollowers: instagramFollowers ?? null,
      tiktokFollowers: tiktokFollowers ?? null,
      facebookFollowers: facebookFollowers ?? null,
      followersUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({ celebrity: { id: celebrity.id, slug: celebrity.slug } }, { status: 201 });
}