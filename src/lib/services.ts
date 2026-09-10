import { prisma } from "./db";
import { tryParseJson } from "./utils";
import { dataUriDims, profileImageUrl } from "./images";
import { platformTotal, displayCountryCount } from "./display";
import { displayFanCountFor } from "./fame";
import { representedCountryList } from "./countries";
import type { FollowerCounts } from "./followers";
import type { CardDesign, MembershipLevelType, SocialLinks } from "./utils";
import type { GoogleInfo } from "./google-info";

/** Factual one-liner for cards/search from the stored knowledge panel (Wikipedia description). */
function panelTagline(json: string | null): string | null {
  const info = tryParseJson<GoogleInfo | null>(json, null);
  const desc = info?.description?.trim();
  return desc && desc.length > 0 ? desc.slice(0, 200) : null;
}

/**
 * The platform's highest represented-country total: the curated base list plus
 * every country found on our active celebrities and fans. This single figure
 * powers the "Countries Represented" counter on EVERY celebrity profile/card,
 * so a community starts at the 58-country floor and automatically grows with
 * the platform whenever a new country appears — no per-celebrity setup needed.
 */
async function platformCountryTotal(): Promise<number> {
  const [fanCountryRows, celebrityCountryRows] = await Promise.all([
    prisma.fan.groupBy({
      by: ["country"],
      where: { isActive: true, country: { not: null } },
      _count: { _all: true },
    }),
    prisma.celebrity.findMany({
      where: { isActive: true },
      select: { country: true },
    }),
  ]);
  return representedCountryList([
    ...celebrityCountryRows.map((r) => r.country),
    ...fanCountryRows.map((r) => r.country),
  ]).length;
}

export type CelebritySummary = {
  id: string;
  slug: string;
  name: string;
  category: string;
  country: string;
  city: string | null;
  profession: string;
  tagline: string | null; // factual one-liner from the Wikipedia/Wikidata panel (e.g. "American actor (born 1963)")
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

  const q = filters.search?.trim().toLowerCase();
  const filtered = q
    ? celebrities.filter((c) =>
        [c.name, c.profession, c.category, c.country, c.city]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q)),
      )
    : celebrities;

  const totalCountries = await platformCountryTotal();

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
      tagline: panelTagline(c.googleInfo),
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
      fanCount: displayFanCountFor(c),
      countryCount: displayCountryCount(totalCountries),
      createdAt: c.createdAt,
      instagramFollowers: c.instagramFollowers,
      tiktokFollowers: c.tiktokFollowers,
      facebookFollowers: c.facebookFollowers,
    };
  });
}

export type CelebrityDetail = CelebritySummary & {
  googleInfo: GoogleInfo | null;
  // Permanent verified official platform links (source of truth).
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  googleUrl: string | null;
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
      memberships: { where: { isActive: true }, orderBy: { displayOrder: "asc" } },
    },
  });
  if (!celebrity) return null;

  const totalCountries = await platformCountryTotal();
  const profileDims = celebrity.profileImage ? dataUriDims(celebrity.profileImage) : null;

  return {
    id: celebrity.id,
    slug: celebrity.slug,
    name: celebrity.name,
    category: celebrity.category,
    country: celebrity.country,
    city: celebrity.city,
    profession: celebrity.profession,
    tagline: panelTagline(celebrity.googleInfo),
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
    fanCount: displayFanCountFor(celebrity),
    countryCount: displayCountryCount(totalCountries),
    createdAt: celebrity.createdAt,
    instagramFollowers: celebrity.instagramFollowers,
    tiktokFollowers: celebrity.tiktokFollowers,
    facebookFollowers: celebrity.facebookFollowers,
    facebookUrl: celebrity.facebookUrl,
    instagramUrl: celebrity.instagramUrl,
    tiktokUrl: celebrity.tiktokUrl,
    googleUrl: celebrity.googleUrl,
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

/**
 * Live platform statistics. Fan and country figures are display totals powered
 * by the growth engine (see display.ts / countries.ts): fans start at 9,272 and
 * climb toward 1,000,000 as communities grow; countries start at a base list of
 * 82 and grow automatically from the countries found on celebrities and fans.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const [celebrities, activeCelebrities, fans, activeCards, totalCards, countriesRows, celebrityCountryRows] =
    await Promise.all([
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
      prisma.celebrity.findMany({
        where: { isActive: true },
        select: {
          slug: true,
          country: true,
          displayFanCount: true,
          googleInfo: true,
          instagramFollowers: true,
          tiktokFollowers: true,
          facebookFollowers: true,
        },
      }),
    ]);

  const displayedCounts = celebrityCountryRows.map((r) => displayFanCountFor(r));

  const countries = representedCountryList([
    ...celebrityCountryRows.map((r) => r.country),
    ...countriesRows.map((r) => r.country),
  ]);

  return {
    celebrities,
    activeCelebrities,
    fans: platformTotal(displayedCounts, fans),
    activeCards,
    totalCards,
    countries: countries.length,
  };
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