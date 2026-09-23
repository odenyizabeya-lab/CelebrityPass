import { prisma } from "./db";
import { cache } from "react";
import { tryParseJson } from "./utils";
import { celebrityImageFlags } from "./images";
import { platformTotal, displayCountryCount } from "./display";
import { displayFanCountFor } from "./fame";
import { representedCountryList } from "./countries";
import type { FollowerCounts } from "./followers";
import type { CardDesign, MembershipLevelType, SocialLinks } from "./utils";
import type { GoogleInfo } from "./google-info";
import type { ProfileClass } from "./profiles/classes";
import { normalizeProfileType } from "./profiles/classes";
import type { InvestorView } from "./profiles/investor";
import { toInvestorView } from "./profiles/investor";

/** Short CDN-cache-busting version token from the stored image hash. */
function imgVersion(hash: string | null): string {
  if (!hash) return "";
  const tail = hash.includes(":") ? hash.split(":").pop()! : hash;
  return tail.slice(0, 8);
}

/** Factual one-liner for cards/search from the stored knowledge panel (Wikipedia description). */
function panelTagline(json: string | null): string | null {
  const info = tryParseJson<GoogleInfo | null>(json, null);
  const desc = info?.description?.trim();
  return desc && desc.length > 0 ? desc.slice(0, 200) : null;
}

const HEAD_OF_STATE_RE = /(^|\b)(president|chairman)\s+of\b|\bpresident\s+since\b|\bleader\s+of\b|prime\s+minister\s+of\b|chancellor\s+of\b|federal councillor\b|federal councilor\b/i;

/** Heads of state (presidents, prime ministers, chancellors) identified from the knowledge panel description. */
export function isWorldLeaderName(googleInfo: string | null): boolean {
  const info = tryParseJson<GoogleInfo | null>(googleInfo, null);
  return info ? HEAD_OF_STATE_RE.test(info.description ?? "") : false;
}

/**
 * Tiny in-process TTL cache for expensive read queries. Public pages are
 * served through Supabase's pooled connection where every round trip costs
 * ~1-2s, so running the same 6-11 queries on every render made pages take
 * tens of seconds. These read caches make repeated loads instant while the
 * short TTL keeps data fresher than the pages' own ISR revalidation window.
 */
const READ_CACHE_TTL_MS = 45_000;
const READ_CACHE_LIMIT = 64;
const readCache = new Map<string, { value: unknown; expires: number }>();
// In-flight loader dedupe so concurrent requests (home SSR + feed xhr) never
// run the same expensive query twice when the cache is cold.
const readInflight = new Map<string, Promise<unknown>>();

function cachedRead<V>(key: string, loader: () => Promise<V>, ttlMs = READ_CACHE_TTL_MS): Promise<V> {
  const now = Date.now();
  const hit = readCache.get(key);
  if (hit && hit.expires > now) return Promise.resolve(hit.value as V);
  const inflight = readInflight.get(key);
  if (inflight) return inflight as Promise<V>;
  const promise = loader()
    .then((value) => {
      readCache.set(key, { value, expires: Date.now() + ttlMs });
      if (readCache.size > READ_CACHE_LIMIT) {
        const oldest = readCache.keys().next().value;
        if (oldest) readCache.delete(oldest);
      }
      return value;
    })
    .finally(() => {
      readInflight.delete(key);
    });
  readInflight.set(key, promise);
  return promise;
}

/**
 * Drops every cached read (represented countries, celebrity summaries,
 * platform stats, search options). Called after admin celebrity writes so the
 * very next request reflects the change instead of up to 45s of stale data.
 */
export function clearReadCache() {
  readCache.clear();
}

/** The live represented-country list (celebrity countries + active fan countries, curated base included). */
export async function getRepresentedCountries(): Promise<string[]> {
  return cachedRead("representedCountries", async () => {
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
    ]);
  });
}

/**
 * The platform's highest represented-country total: the curated base list plus
 * every country found on our active celebrities and fans. This single figure
 * powers the "Countries Represented" counter on EVERY celebrity profile/card,
 * so a community starts at the 58-country floor and automatically grows with
 * the platform whenever a new country appears — no per-celebrity setup needed.
 */
async function platformCountryTotal(): Promise<number> {
  return (await getRepresentedCountries()).length;
}

export type CelebritySummary = {
  id: string;
  slug: string;
  name: string;
  category: string;
  country: string;
  city: string | null;
  profession: string;
  bio: string | null; // admin-written biography paragraph
  tagline: string | null; // factual one-liner from the Wikipedia/Wikidata panel (e.g. "American actor (born 1963)")
  profileImage: string | null;
  coverImage: string | null;
  profileImageUrl: string | null;
  profileImageW: number;
  profileImageH: number;
  coverImageUrl: string | null;
  imageVerified: boolean;
  imageStatus: string | null;
  imageLicense: string | null;
  imageAttribution: string | null;
  imageSourceUrl: string | null;
  accentColor: string;
  isFeatured: boolean;
  isWorldLeader: boolean;
  isActive: boolean;
  isVerified: boolean;
  profileType: ProfileClass;
  fansCardEnabled: boolean;
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
type CelebritySummaryRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  country: string;
  city: string | null;
  profession: string;
  googleInfo: string | null;
  bio: string | null;
  accentColor: string;
  isFeatured: boolean;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  instagramFollowers: number | null;
  tiktokFollowers: number | null;
  facebookFollowers: number | null;
  displayFanCount: number | null;
  imageVerified: boolean;
  imageStatus: string | null;
  imageLicense: string | null;
  imageAttribution: string | null;
  imageSourceUrl: string | null;
  profileImageHash: string | null;
  coverImageHash: string | null;
  profileType: string | null;
  fansCardEnabled: boolean;
};

function mapCelebritySummary(
  c: CelebritySummaryRow,
  imageFlags: Map<string, { hasProfile: boolean; hasCover: boolean }>,
  totalCountries: number,
): CelebritySummary {
  const img = imageFlags.get(c.slug);
  const hasProfile = img?.hasProfile ?? false;
  const hasCover = img?.hasCover ?? false;
  const profileV = imgVersion(c.profileImageHash);
  const coverV = imgVersion(c.coverImageHash);
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    category: c.category,
    country: c.country,
    city: c.city,
    profession: c.profession,
    bio: c.bio,
    tagline: panelTagline(c.googleInfo) ?? c.bio,
    profileImage: hasProfile ? `/images/${c.slug}/profile${profileV ? "?v=" + profileV : ""}` : null,
    coverImage: hasCover ? `/images/${c.slug}/cover${coverV ? "?v=" + coverV : ""}` : null,
    profileImageUrl: hasProfile ? `/images/${c.slug}/profile${profileV ? "?v=" + profileV : ""}` : null,
    profileImageW: hasProfile ? 375 : 144,
    profileImageH: hasProfile ? 500 : 180,
    coverImageUrl: hasCover ? `/images/${c.slug}/cover${coverV ? "?v=" + coverV : ""}` : null,
    imageVerified: c.imageVerified,
    imageStatus: c.imageStatus,
    imageLicense: c.imageLicense,
    imageAttribution: c.imageAttribution,
    imageSourceUrl: c.imageSourceUrl,
    accentColor: c.accentColor,
    isFeatured: c.isFeatured,
    isWorldLeader: isWorldLeaderName(c.googleInfo),
    isActive: c.isActive,
    isVerified: c.isVerified,
    profileType: normalizeProfileType(c.profileType),
    fansCardEnabled: c.fansCardEnabled,
    fanCount: displayFanCountFor(c),
    countryCount: displayCountryCount(totalCountries),
    createdAt: c.createdAt,
    instagramFollowers: c.instagramFollowers,
    tiktokFollowers: c.tiktokFollowers,
    facebookFollowers: c.facebookFollowers,
  };
}

/**
 * One page of the infinite home feed, paginated IN THE DATABASE. Fetches only
 * the requested slice (one small query) instead of loading all ~775 rows and
 * slicing in JS — so a feed page is fast even on a cold cache/instance and
 * across requests that share no in-memory state.
 */
export async function getCelebrityFeedPage(opts: {
  offset: number;
  limit: number;
  excludeIds?: readonly string[];
}): Promise<{ items: CelebrityCardData[]; total: number; done: boolean }> {
  const where: { isActive: boolean; id?: { notIn: string[] } } = { isActive: true };
  const excluded = opts.excludeIds?.filter(Boolean) ?? [];
  if (excluded.length > 0) where.id = { notIn: excluded };

  const [celebrities, imageFlags, totalCountries] = await Promise.all([
    prisma.celebrity.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      skip: opts.offset,
      take: opts.limit + 1,
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        country: true,
        city: true,
        profession: true,
        googleInfo: true,
        bio: true,
        accentColor: true,
        isFeatured: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        instagramFollowers: true,
        tiktokFollowers: true,
        facebookFollowers: true,
        displayFanCount: true,
        imageVerified: true,
        imageStatus: true,
        imageLicense: true,
        imageAttribution: true,
        imageSourceUrl: true,
        profileImageHash: true,
        coverImageHash: true,
        profileType: true,
        fansCardEnabled: true,
      },
    }),
    celebrityImageFlags(),
    platformCountryTotal(),
  ]);

  const hasNext = celebrities.length > opts.limit;
  const slice = celebrities.slice(0, opts.limit);
  const items = slice.map((c) => toCardCelebrity(mapCelebritySummary(c, imageFlags, totalCountries)));
  return { items, total: opts.offset + slice.length, done: !hasNext };
}

export async function getCelebritySummaries(filters: CelebritiesFilters = {}): Promise<CelebritySummary[]> {
  return cachedRead(`summaries:${JSON.stringify(filters)}`, async () => {
    const where: Record<string, unknown> = {};
    if (!filters.includeInactive) where.isActive = true;

    if (filters.category) where.category = filters.category;
    if (filters.country) where.country = filters.country;
    if (filters.profession) where.profession = filters.profession;

    const [celebrities, imageFlags] = await Promise.all([
    prisma.celebrity.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        country: true,
        city: true,
        profession: true,
        googleInfo: true,
        bio: true,
        accentColor: true,
        isFeatured: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        instagramFollowers: true,
        tiktokFollowers: true,
        facebookFollowers: true,
        displayFanCount: true,
        imageVerified: true,
        imageStatus: true,
        imageLicense: true,
        imageAttribution: true,
        imageSourceUrl: true,
        profileImageHash: true,
        coverImageHash: true,
        profileType: true,
        fansCardEnabled: true,
      },
    }),
    celebrityImageFlags(),
  ]);

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
    const img = imageFlags.get(c.slug);
    const hasProfile = img?.hasProfile ?? false;
    const hasCover = img?.hasCover ?? false;
    const profileV = imgVersion(c.profileImageHash);
    const coverV = imgVersion(c.coverImageHash);
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      category: c.category,
      country: c.country,
      city: c.city,
      profession: c.profession,
      bio: c.bio,
      tagline: panelTagline(c.googleInfo) ?? c.bio,
      profileImage: hasProfile ? `/images/${c.slug}/profile${profileV ? "?v=" + profileV : ""}` : null,
      coverImage: hasCover ? `/images/${c.slug}/cover${coverV ? "?v=" + coverV : ""}` : null,
      profileImageUrl: hasProfile ? `/images/${c.slug}/profile${profileV ? "?v=" + profileV : ""}` : null,
      profileImageW: hasProfile ? 375 : 144,
      profileImageH: hasProfile ? 500 : 180,
      coverImageUrl: hasCover ? `/images/${c.slug}/cover${coverV ? "?v=" + coverV : ""}` : null,
      imageVerified: c.imageVerified,
      imageStatus: c.imageStatus,
      imageLicense: c.imageLicense,
      imageAttribution: c.imageAttribution,
      imageSourceUrl: c.imageSourceUrl,
      accentColor: c.accentColor,
      isFeatured: c.isFeatured,
      isWorldLeader: isWorldLeaderName(c.googleInfo),
      isActive: c.isActive,
      isVerified: c.isVerified,
      profileType: normalizeProfileType(c.profileType),
      fansCardEnabled: c.fansCardEnabled,
      fanCount: displayFanCountFor(c),
      countryCount: displayCountryCount(totalCountries),
      createdAt: c.createdAt,
      instagramFollowers: c.instagramFollowers,
      tiktokFollowers: c.tiktokFollowers,
      facebookFollowers: c.facebookFollowers,
    };
    });
  });
}

export type CelebrityDetail = CelebritySummary & {
  bio: string | null;
  googleInfo: GoogleInfo | null;
  // Permanent verified official platform links (source of truth).
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  googleUrl: string | null;
  socialLinks: SocialLinks;
  cardDesign: CardDesign;
  memberships: MembershipLevelType[];
  investor: InvestorView | null;
};

/** Slugs of all active communities (used for static generation). */
export const listActiveCelebritySlugs = cache(async (): Promise<{ slug: string }[]> => {
  const rows = await prisma.celebrity.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  return rows;
});

/**
 * Full data for a single celebrity community.
 *
 * Wrapped in React `cache()` so `generateMetadata` and the page body in the
 * same request share ONE fetch instead of running the whole load twice, and
 * all three reads run in parallel (they are independent) so a cold cache pays
 * a single round-trip, not a 3-step waterfall.
 */
export const getCelebrityBySlug = cache(async (slug: string): Promise<CelebrityDetail | null> => {
  // Deliberately select scalars EXCEPT the giant base64 profileImage/coverImage
  // blobs: a full-row read transferred up to ~3MB per profile render. Presence
  // is derived from the hash columns so image URLs stay exact and cacheable,
  // and the /images/... routes do the single heavy read (cached) on demand.
  const find = (where: { slug: string } | { nameKey: string }) =>
    prisma.celebrity.findUnique({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        country: true,
        city: true,
        profession: true,
        bio: true,
        googleInfo: true,
        accentColor: true,
        isFeatured: true,
        isActive: true,
        isVerified: true,
        displayFanCount: true,
        createdAt: true,
        instagramFollowers: true,
        tiktokFollowers: true,
        facebookFollowers: true,
        facebookUrl: true,
        instagramUrl: true,
        tiktokUrl: true,
        googleUrl: true,
        socialLinks: true,
        cardDesign: true,
        imageVerified: true,
        imageStatus: true,
        imageLicense: true,
        imageAttribution: true,
        imageSourceUrl: true,
        profileImageHash: true,
        coverImageHash: true,
        profileType: true,
        fansCardEnabled: true,
        investorProfile: {
          select: {
            enabled: true,
            overview: true,
            sector: true,
            ventures: true,
            opportunities: true,
            eligibility: true,
            risks: true,
            disclaimer: true,
            sourcesJson: true,
            verifiedAt: true,
            updatedAt: true,
          },
        },
        memberships: { where: { isActive: true }, orderBy: { displayOrder: "asc" } },
      },
    });

  // Exact slug match first; fall back to the accent/case-insensitive name key so
  // transliterated or escape-decoded URLs resolve to the right profile too.
  let celebrity = await find({ slug });
  if (!celebrity && slug) {
    const key = slug.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    if (key) celebrity = await find({ nameKey: key });
  }
  const [totalCountries, flags] = await Promise.all([
    platformCountryTotal(),
    celebrityImageFlags(),
  ]);
  if (!celebrity) return null;

  const hasProfile = flags.get(celebrity.slug)?.hasProfile ?? false;
  const hasCover = flags.get(celebrity.slug)?.hasCover ?? false;

  const detailProfileV = imgVersion(celebrity.profileImageHash);
    const detailCoverV = imgVersion(celebrity.coverImageHash);
    return {
    id: celebrity.id,
    slug: celebrity.slug,
    name: celebrity.name,
    category: celebrity.category,
    country: celebrity.country,
    city: celebrity.city,
    profession: celebrity.profession,
    bio: celebrity.bio,
    tagline: panelTagline(celebrity.googleInfo),
    googleInfo: tryParseJson<GoogleInfo | null>(celebrity.googleInfo, null),
    profileImage: null,
    coverImage: null,
    profileImageUrl: hasProfile ? `/images/${celebrity.slug}/profile${detailProfileV ? "?v=" + detailProfileV : ""}` : null,
    profileImageW: hasProfile ? 600 : 500,
    profileImageH: hasProfile ? 750 : 625,
    coverImageUrl: hasCover ? `/images/${celebrity.slug}/cover${detailCoverV ? "?v=" + detailCoverV : ""}` : null,
    imageVerified: celebrity.imageVerified,
    imageStatus: celebrity.imageStatus,
    imageLicense: celebrity.imageLicense,
    imageAttribution: celebrity.imageAttribution,
    imageSourceUrl: celebrity.imageSourceUrl,
    accentColor: celebrity.accentColor,
    isFeatured: celebrity.isFeatured,
    isWorldLeader: isWorldLeaderName(celebrity.googleInfo),
    isActive: celebrity.isActive,
    isVerified: celebrity.isVerified,
    profileType: normalizeProfileType(celebrity.profileType),
    fansCardEnabled: celebrity.fansCardEnabled,
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
    investor: celebrity.investorProfile
      ? toInvestorView(celebrity.investorProfile)
      : null,
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
});

/** Get a single fan card with celebrity + fan + level, for public views. */
export async function getFanCardByNumber(fanNumber: string) {
  const [card, imageFlags] = await Promise.all([
    prisma.fanCard.findUnique({
      where: { fanNumber },
      include: {
        celebrity: {
          select: { id: true, slug: true, name: true, accentColor: true, cardDesign: true, isVerified: true },
        },
        fan: true,
        membershipLevel: true,
      },
    }),
    celebrityImageFlags(),
  ]);
  if (!card) return null;
  const img = imageFlags.get(card.celebrity.slug);
  return {
    ...card,
    celebrity: {
      ...card.celebrity,
      profileImage: img?.hasProfile ? `/images/${card.celebrity.slug}/profile` : null,
      coverImage: img?.hasCover ? `/images/${card.celebrity.slug}/cover` : null,
    },
  };
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
  return cachedRead("platformStats", async () => {
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
  });
}

/** Distinct filter options derived from the database. */
export async function getSearchOptions() {
  return cachedRead("searchOptions", async () => {
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
  });
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