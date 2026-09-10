import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { tryParseJson } from "@/lib/utils";
import { celebrityImageFlags } from "@/lib/images";
import type { GoogleInfo } from "@/lib/google-info";

export const dynamic = "force-dynamic";

const SEARCH_LIMIT = 8;
const CANDIDATE_LIMIT = 40;

type CelebrityRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  profession: string;
  googleInfo: string | null;
  isVerified: boolean;
  accentColor: string;
};

export type CelebritySearchItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  profession: string;
  tagline: string | null;
  profileImageUrl: string | null;
  isVerified: boolean;
  accentColor: string;
};

function taglineOf(json: string | null): string | null {
  const info = tryParseJson<GoogleInfo | null>(json, null);
  const desc = info?.description?.trim();
  return desc && desc.length > 0 ? desc.slice(0, 200) : null;
}

function toItem(c: CelebrityRow, hasProfile: boolean): CelebritySearchItem {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    category: c.category,
    profession: c.profession,
    tagline: taglineOf(c.googleInfo),
    profileImageUrl: hasProfile ? `/images/${c.slug}/profile` : null,
    isVerified: c.isVerified,
    accentColor: c.accentColor,
  };
}

const SELECT = {
  id: true,
  slug: true,
  name: true,
  category: true,
  profession: true,
  country: true,
  city: true,
  googleInfo: true,
  isVerified: true,
  accentColor: true,
} as const;

// GET /api/celebrities/search?q=Tom
// Server-side live autocomplete over the REAL celebrity table — every
// celebrity added in Admin becomes searchable instantly. Results are ranked so
// prefix matches on the name win, then substrings, then category/profession.
export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  const q = raw.toLowerCase();

  if (!q) {
    // Empty query => trending suggestions (the most popular active communities).
    const [celebs, flags] = await Promise.all([
      prisma.celebrity.findMany({
        where: { isActive: true },
        orderBy: [{ isFeatured: "desc" }, { displayFanCount: "desc" }],
        take: SEARCH_LIMIT,
        select: SELECT,
      }),
      celebrityImageFlags(),
    ]);
    return NextResponse.json({
      query: raw,
      results: celebs.map((c) => toItem(c, flags.get(c.slug)?.hasProfile ?? false)),
      trending: true,
    });
  }

  const [celebs, flags] = await Promise.all([
    prisma.celebrity.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: raw, mode: "insensitive" } },
          { category: { contains: raw, mode: "insensitive" } },
          { profession: { contains: raw, mode: "insensitive" } },
          { country: { contains: raw, mode: "insensitive" } },
          { city: { contains: raw, mode: "insensitive" } },
        ],
      },
      orderBy: [{ isFeatured: "desc" }, { displayFanCount: "desc" }],
      take: CANDIDATE_LIMIT,
      select: SELECT,
    }),
    celebrityImageFlags(),
  ]);

  const spaced = q.replace(/\s+/g, " ");
  const ranked = celebs
    .map((c) => {
      const name = c.name.toLowerCase();
      let score = 0;
      if (name === spaced) score += 300;
      else if (name.startsWith(spaced)) score += 200;
      else if (name.includes(spaced)) score += 100;
      if (c.profession.toLowerCase().includes(spaced)) score += 10;
      if (c.category.toLowerCase().includes(spaced)) score += 8;
      if (c.country.toLowerCase().includes(spaced)) score += 4;
      if (spaced.length >= 3 && name.includes(spaced.slice(0, 3))) score += 2;
      return { c, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, SEARCH_LIMIT);

  return NextResponse.json({
    query: raw,
    results: ranked.map((r) => toItem(r.c, flags.get(r.c.slug)?.hasProfile ?? false)),
    trending: false,
  });
}