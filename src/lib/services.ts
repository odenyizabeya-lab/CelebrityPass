import { prisma } from "./db";
import { tryParseJson } from "./utils";
import { dataUriDims, profileImageUrl } from "./images";
import type { FollowerCounts } from "./followers";
import type { CardDesign, MembershipLevelType, SocialLinks } from "./utils";
import type { GoogleInfo } from "./google-info";

export type CelebritySummary = {
  id: string;
  slug: string;
  name: string;
  category: string;
  country: string;
  city: string | null;
  profession: string;
  bio: string;
  shortBio: string | null;
  profileImage: string | null;
  coverImage: string | null;
  profileImageUrl: string | null;
  profileImageW: number;
  profileImageH: number;
  coverImageUrl: string | null;
  accentColor: string;
  isFeatured: boolean;
  isActive: boolean;
  isVerified: boolean;
  fanCount: number;
  countryCount: number;
  createdAt: Date;
} & FollowerCounts;

export type CelebritiesFilters = {
  search?: string;
  category?: string;
  country?: string;
  profession?: string;
  includeInactive?: boolean;
};

/**
 * Web UI events receive card data WITHOUT the raw base64 data URIs, since
 * those must never cross the server→client boundary (they would make every
 * RSC payload megabytes). Only cacheable image URLs are sent to the browser.
 */
export type CelebrityCardData = Omit<CelebritySummary, "profileImage" | "coverImage">;

export function toCardCelebrity(c: CelebritySummary): CelebrityCardData {
  const { profileImage, coverImage, ...rest } = c;
  void profileImage;
  void coverImage;
  return rest;
}

/** List celebrity communities with LIVE fan/community stats. */
export async function getCelebritySummaries(filters: CelebritiesFilters = {}): Promise<CelebritySummary[]> {
  const where: Record<string, unknown> = {};
  if (!filters.includeInactive) where.isActive = true;

  if (filters.category) where.category = filters.category;
  if (filters.country) where.country = filters.country;
  if (filters.profession) where.profession = filters.profession;

  const celebrities = await prisma.celebrity.findMany({
    where,
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
  });

  const [countRows, countryRows] = await Promise.all([
    prisma.fanCard.groupBy({
      by: ["celebrityId"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.fanCard.findMany({
      where: { status: "ACTIVE" },
      select: { celebrityId: true, fan: { select: { country: true } } },
    }),
  ]);

  const fanCountByCeleb = new Map(countRows.map((r) => [r.celebrityId, r._count._all]));
  const countriesByCeleb = new Map<string, Set<string>>();
  for (const row of countryRows) {
    const cc = row.fan.country;
    if (!cc) continue;
    const set = countriesByCeleb.get(row.celebrityId) ?? new Set<string>();
    set.add(cc);
    countriesByCeleb.set(row.celebrityId, set);
  }

  const q = filters.search?.trim().toLowerCase();
  const filtered = q
    ? celebrities.filter((c) =>
        [c.name, c.profession, c.category, c.country, c.city]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q)),
      )
    : celebrities;

  return filtered.map((c) => {
    const profileDims = c.profileImage ? dataUriDims(c.profileImage) : null;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      category: c.category,
      country: c.country,
      city: c.city,
      profession: c.profession,
      bio: c.bio,
      shortBio: c.shortBio,
      profileImage: c.profileImage,
      coverImage: c.coverImage,
      profileImageUrl: c.profileImage ? profileImageUrl(c.slug, c.profileImage) : null,
      profileImageW: profileDims?.w ?? 144,
      profileImageH: profileDims?.h ?? 180,
      coverImageUrl: c.coverImage ? `/images/${c.slug}/cover` : null,
      accentColor: c.accentColor,
      isFeatured: c.isFeatured,
      isActive: c.isActive,
      isVerified: c.isVerified,
      fanCount: fanCountByCeleb.get(c.id) ?? 0,
      countryCount: countriesByCeleb.get(c.id)?.size ?? 0,
      createdAt: c.createdAt,
      instagramFollowers: c.instagramFollowers,
      tiktokFollowers: c.tiktokFollowers,
      facebookFollowers: c.facebookFollowers,
    };
  });
}

export type CelebrityDetail = CelebritySummary & {
  googleOverview: string | null;
  googleInfo: GoogleInfo | null;
  socialLinks: SocialLinks;
  cardDesign: CardDesign;
  memberships: MembershipLevelType[];
};

/** Slugs of all active communities (used for static generation). */
export async function listActiveCelebritySlugs(): Promise<{ slug: string }[]> {
  const rows = await prisma.celebrity.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  return rows;
}

/** Full data for a single celebrity community. */
export async function getCelebrityBySlug(slug: string): Promise<CelebrityDetail | null> {
  const celebrity = await prisma.celebrity.findUnique({
    where: { slug },
    include: {
      fans: {
        where: { status: "ACTIVE" },
        select: { id: true, fan: { select: { country: true } } },
      },
      memberships: { where: { isActive: true }, orderBy: { displayOrder: "asc" } },
    },
  });
  if (!celebrity) return null;

  const activeFans = celebrity.fans;
  const countries = new Set(activeFans.map((f) => f.fan.country).filter(Boolean));
  const profileDims = celebrity.profileImage ? dataUriDims(celebrity.profileImage) : null;

  return {
    id: celebrity.id,
    slug: celebrity.slug,
    name: celebrity.name,
    category: celebrity.category,
    country: celebrity.country,
    city: celebrity.city,
    profession: celebrity.profession,
    bio: celebrity.bio,
    shortBio: celebrity.shortBio,
    googleOverview: celebrity.googleOverview,
    googleInfo: tryParseJson<GoogleInfo | null>(celebrity.googleInfo, null),
    profileImage: celebrity.profileImage,
    coverImage: celebrity.coverImage,
    profileImageUrl: celebrity.profileImage ? profileImageUrl(celebrity.slug, celebrity.profileImage) : null,
    profileImageW: profileDims?.w ?? 500,
    profileImageH: profileDims?.h ?? 625,
    coverImageUrl: celebrity.coverImage ? `/images/${celebrity.slug}/cover` : null,
    accentColor: celebrity.accentColor,
    isFeatured: celebrity.isFeatured,
    isActive: celebrity.isActive,
    isVerified: celebrity.isVerified,
    fanCount: activeFans.length,
    countryCount: countries.size,
    createdAt: celebrity.createdAt,
    instagramFollowers: celebrity.instagramFollowers,
    tiktokFollowers: celebrity.tiktokFollowers,
    facebookFollowers: celebrity.facebookFollowers,
    socialLinks: tryParseJson<SocialLinks>(celebrity.socialLinks, {}),
    cardDesign: tryParseJson<CardDesign>(celebrity.cardDesign, { primary: celebrity.accentColor }),
    memberships: celebrity.memberships.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      benefits: m.benefits,
      price: m.price,
      currency: m.currency,
      displayOrder: m.displayOrder,
      isActive: m.isActive,
    })),
  };
}

/** Get a single fan card with celebrity + fan + level, for public views. */
export async function getFanCardByNumber(fanNumber: string) {
  return prisma.fanCard.findUnique({
    where: { fanNumber },
    include: { celebrity: true, fan: true, membershipLevel: true },
  });
}

export type PlatformStats = {
  celebrities: number;
  activeCelebrities: number;
  fans: number;
  activeCards: number;
  totalCards: number;
  countries: number;
};

/** Live platform statistics — every figure comes from the database. */
export async function getPlatformStats(): Promise<PlatformStats> {
  const [celebrities, activeCelebrities, fans, activeCards, totalCards, countriesRows] = await Promise.all([
    prisma.celebrity.count(),
    prisma.celebrity.count({ where: { isActive: true } }),
    prisma.fan.count({ where: { isActive: true } }),
    prisma.fanCard.count({ where: { status: "ACTIVE" } }),
    prisma.fanCard.count(),
    prisma.fan.groupBy({
      by: ["country"],
      where: { isActive: true, country: { not: null } },
      _count: { _all: true },
    }),
  ]);

  return { celebrities, activeCelebrities, fans, activeCards, totalCards, countries: countriesRows.length };
}

/** Distinct filter options derived from the database. */
export async function getSearchOptions() {
  const rows = await prisma.celebrity.findMany({
    where: { isActive: true },
    select: { category: true, country: true, profession: true },
    distinct: ["category", "country", "profession"],
  });
  return {
    categories: [...new Set(rows.map((r) => r.category).filter(Boolean))].sort(),
    countries: [...new Set(rows.map((r) => r.country).filter(Boolean))].sort(),
    professions: [...new Set(rows.map((r) => r.profession).filter(Boolean))].sort(),
  };
}

export type AdminCardRow = {
  id: string;
  fanNumber: string;
  status: string;
  registeredAt: Date;
  fanName: string;
  fanEmail: string;
  fanCountry: string | null;
  celebrityName: string;
  celebritySlug: string;
  membershipName: string | null;
};

export async function listAdminCards(filters: {
  search?: string;
  celebrityId?: string;
  status?: string;
}): Promise<AdminCardRow[]> {
  const where: Record<string, unknown> = {};
  if (filters.celebrityId) where.celebrityId = filters.celebrityId;
  if (filters.status) where.status = filters.status;
  const cards = await prisma.fanCard.findMany({
    where,
    include: {
      fan: { select: { name: true, email: true, country: true } },
      celebrity: { select: { name: true, slug: true } },
      membershipLevel: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const q = filters.search?.trim().toLowerCase();
  const visible = q
    ? cards.filter((c) =>
        [c.fanNumber, c.fan.name, c.fan.email, c.celebrity.name]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q)),
      )
    : cards;

  return visible.map((c) => ({
    id: c.id,
    fanNumber: c.fanNumber,
    status: c.status,
    registeredAt: c.registeredAt,
    fanName: c.fan.name,
    fanEmail: c.fan.email,
    fanCountry: c.fan.country,
    celebrityName: c.celebrity.name,
    celebritySlug: c.celebrity.slug,
    membershipName: c.membershipLevel?.name ?? null,
  }));
}