// Orchestrates the Automatic Celebrity Scanner (v2 — rebuilt 2026-09).
//
//   image -> identify (Gemini vision) -> duplicate check (existing DB)
//         -> research profile + fan card + base membership tiers (Gemini +
//           Google Search grounding) -> [optional] public events
//
// Runs server-side only. The result is a ScanResult the REAL admin form fills
// itself with for review — nothing is written to the DB by a scan.
//
// Resilience vs the old scanner:
//   - The configured model may be retired; the credential chain climbs the
//     current model catalog automatically instead of failing.
//   - A broken key (invalid/suspended/quota/billing) is skipped, never fatal.
//   - Transient network/server failures are retried with backoff.
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { getAIModel, getGeminiKeys } from "./settings";
import {
  AiCallError,
  buildCredentialChain,
  callAcrossCredentials,
  friendlyAiError,
  identifyPerson,
  researchProfile,
  researchEvents,
  type GeminiCredential,
} from "./client";
import type {
  IdentifiedPerson,
  PrepMembershipTier,
  ScanEvent,
  ScanOutcome,
  ScanProfile,
} from "./types";

export const CELEBRITY_CATEGORIES = ["Actor", "Musician", "Athlete", "Creator", "Public Figure", "Artist"] as const;

/** Safe category: force any AI output into the platform's existing set. */
function normalizeCategory(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (CELEBRITY_CATEGORIES.includes(v as (typeof CELEBRITY_CATEGORIES)[number])) return v;
  const lower = v.toLowerCase();
  if (/actor|actress/.test(lower)) return "Actor";
  if (/singer|music|rapper|vocal|musician/.test(lower)) return "Musician";
  if (/football|cricket|athlete|soccer|player|basketb|tennis|boxing/.test(lower)) return "Athlete";
  if (/youtuber|creator|influencer|streamer/.test(lower)) return "Creator";
  if (/artist|painter|sculptor|photographer/.test(lower)) return "Artist";
  return "Public Figure";
}

function asString(v: unknown, max = 8000): string {
  if (typeof v === "string") return v.slice(0, max).trim();
  return "";
}

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

async function findExistingCommunity(name: string): Promise<{ id: string; slug: string; name: string } | null> {
  try {
    const exact = await prisma.celebrity.findFirst({ where: { name }, select: { id: true, slug: true, name: true } });
    if (exact) return exact;
    const slug = slugify(name);
    if (slug) {
      const bySlug = await prisma.celebrity.findUnique({ where: { slug }, select: { id: true, slug: true, name: true } });
      if (bySlug) return bySlug;
    }
    const all = await prisma.celebrity.findMany({ select: { id: true, slug: true, name: true } });
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(name);
    return all.find((c) => norm(c.name) === target) ?? null;
  } catch {
    return null; // never block a scan on the lookup
  }
}

/**
 * Standard base membership tiers for every community. There is no free tier;
 * every fan card membership is a paid level — LEVEL 1 = Premium ($1,000),
 * LEVEL 2 = VIP ($1,700). Premium $2,500+ Signature Experiences are added
 * separately at publish time.
 */
const BASE_MEMBERSHIP_TIERS: PrepMembershipTier[] = [
  {
    name: "Premium",
    description: "Premium fan card membership with exclusive community perks.",
    price: 1000,
    currency: "USD",
  },
  {
    name: "VIP",
    description: "VIP fan card membership with top-tier community status.",
    price: 1700,
    currency: "USD",
  },
];

type RawProfileSchema = Awaited<ReturnType<typeof researchProfile>>;
type RawEventsSchema = Awaited<ReturnType<typeof researchEvents>>;

/** Maps a raw Gemini profile into the exact ScanProfile type. */
function normalizeProfile(name: string, raw: RawProfileSchema): ScanProfile {
  const membership =
    Array.isArray(raw.base_memberships) && raw.base_memberships.length >= 2
      ? raw.base_memberships.slice(0, 2)
      : BASE_MEMBERSHIP_TIERS;

  const cleanMembership = membership
    .map((m, i) => ({
      name: asString(m?.name, 60) || BASE_MEMBERSHIP_TIERS[i]?.name || "Premium",
      description: asString(m?.description, 300) || "Fan membership tier.",
      price:
        typeof m?.price === "number" && Number.isFinite(m.price) && m.price > 0
          ? m.price
          : (BASE_MEMBERSHIP_TIERS[i]?.price ?? 1000),
      currency: asString(m?.currency, 4) || "USD",
    }))
    .slice(0, 2);

  return {
    name: asString(raw.name, 120) || name,
    aliases: asArray(raw.aliases).slice(0, 8),
    category: normalizeCategory(raw.category),
    profession: asString(raw.profession, 120) || "Public Figure",
    country: asString(raw.country, 80) || "",
    city: asString(raw.city, 80) || null,
    website: asString(raw.website, 500) || null,
    accentColor: /^#[0-9a-fA-F]{6}$/.test(asString(raw.accent_color, 9)) ? asString(raw.accent_color, 9) : "#8b5cf6",
    socials: {
      facebook: asString(raw.socials?.facebook, 500) || null,
      instagram: asString(raw.socials?.instagram, 500) || null,
      tiktok: asString(raw.socials?.tiktok, 500) || null,
      google: asString(raw.socials?.google, 500) || null,
    },
    followers: {
      instagram: typeof raw.followers?.instagram === "number" && raw.followers.instagram > 0 ? raw.followers.instagram : null,
      tiktok: typeof raw.followers?.tiktok === "number" && raw.followers.tiktok > 0 ? raw.followers.tiktok : null,
      facebook: typeof raw.followers?.facebook === "number" && raw.followers.facebook > 0 ? raw.followers.facebook : null,
    },
    cardDesign: {
      badgeText: asString(raw.card_design?.badge_text, 40) || "OFFICIAL FAN MEMBER",
      watermark: asString(raw.card_design?.watermark, 40) || "OFFICIAL FAN MEMBER",
      accent: asString(raw.card_design?.accent, 9) || raw.accent_color || "#f59e0b",
    },
    baseMemberships: cleanMembership,
    sourceUrls: asArray(raw.source_urls).slice(0, 8),
  };
}

function normalizeEvents(raw: RawEventsSchema): ScanEvent[] {
  if (!Array.isArray(raw?.events)) return [];
  const seen = new Set<string>();
  const out: ScanEvent[] = [];
  for (const e of raw.events.slice(0, 12)) {
    const name = asString(e?.name, 160);
    const startDate = asString(e?.start_date, 10);
    const sourceUrl = asString(e?.source_url, 500);
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) continue;
    if (!sourceUrl) continue; // never include an event without a real public source
    const dedupeKey = `${name}|${startDate}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      name,
      type: asString(e?.type, 40) || "Other",
      description: asString(e?.description, 400) || null,
      venue: asString(e?.venue, 160) || null,
      city: asString(e?.city, 120) || null,
      country: asString(e?.country, 80) || null,
      startDate,
      startTime: /^\d{2}:\d{2}$/.test(asString(e?.start_time, 5)) ? asString(e?.start_time, 5) : null,
      timezone: asString(e?.timezone, 60) || null,
      officialUrl: asString(e?.official_url, 500) || null,
      sourceUrl,
    });
  }
  return out;
}

/**
 * Some Gemini models don't allow search grounding together with a JSON
 * responseSchema, and free-tier plans can rate-limit or bill-block grounded
 * research. Whenever the grounded call fails for a non-terminal reason the
 * scanner retries strictly from knowledge — the system prompt still demands
 * verified facts (no inventing).
 */
async function researchProfileSmart(c: GeminiCredential, name: string): Promise<RawProfileSchema> {
  try {
    return await researchProfile(c, name, true);
  } catch (e) {
    if (e instanceof AiCallError && ["unsupported_combination", "quota", "billing", "model"].includes(e.type)) {
      return await researchProfile(c, name, false);
    }
    throw e;
  }
}

async function researchEventsSmart(c: GeminiCredential, name: string): Promise<RawEventsSchema> {
  try {
    return await researchEvents(c, name, true);
  } catch (e) {
    if (e instanceof AiCallError && ["unsupported_combination", "quota", "billing", "model"].includes(e.type)) {
      return await researchEvents(c, name, false);
    }
    throw e;
  }
}

/** Build the ordered credential chain from DB settings + env (best key first). */
async function credentialChain(): Promise<GeminiCredential[]> {
  const model = await getAIModel();
  const keys = await getGeminiKeys();
  const sources: { key: string; label: string }[] = [];
  if (keys.primary) sources.push({ key: keys.primary, label: keys.primarySource === "db" ? "Gemini primary key" : "GEMINI_API_KEY env" });
  if (keys.backup) sources.push({ key: keys.backup, label: keys.backupSource === "db" ? "Gemini backup key" : "GEMINI_BACKUP_API_KEY env" });
  if (process.env.GEMINI_API_KEY?.trim()) sources.push({ key: process.env.GEMINI_API_KEY.trim(), label: "GEMINI_API_KEY env" });
  if (process.env.GEMINI_BACKUP_API_KEY?.trim()) sources.push({ key: process.env.GEMINI_BACKUP_API_KEY.trim(), label: "GEMINI_BACKUP_API_KEY env" });
  return buildCredentialChain(sources, model);
}

/**
 * Runs the full scan for one uploaded image.
 * Returns an error-free outcome the API route serializes for admin review.
 */
export async function runCelebrityScan(imageDataUri: string, opts: { includeEvents?: boolean } = {}): Promise<ScanOutcome> {
  const pairs = await credentialChain();
  if (pairs.length === 0) {
    return {
      status: "provider_error",
      message: "No Gemini API key is configured yet. Open Admin → AI Settings to add your key, or set GEMINI_API_KEY.",
    };
  }

  // 1) Identify the person in the image.
  let identity: IdentifiedPerson;
  try {
    const identified = await callAcrossCredentials(pairs, (c) => identifyPerson(c, imageDataUri));
    // A valid low-confidence answer is NOT retried on another key — the image
    // itself is unclear, so a fallback key would only guess. Ask for a clearer photo.
    identity = {
      identified: typeof identified.value.identified === "boolean" ? identified.value.identified : false,
      bestName: asString(identified.value.best_name, 120) || null,
      names: asArray(identified.value.names).slice(0, 6),
      confidence: identified.value.confidence === "high" ? "high" : "low",
      reason: asString(identified.value.reason, 400) || null,
    };
  } catch (e) {
    const { message, detail } = friendlyAiError(e);
    return { status: "provider_error", message, detail };
  }

  if (!identity.identified || identity.confidence !== "high" || !identity.bestName) {
    return {
      status: "low_confidence",
      identity,
    };
  }

  const name = identity.bestName;

  // 2) Already here? (duplicate detection vs existing DB communities)
  const duplicateOf = await findExistingCommunity(name);

  // 3) Research the profile (facts + fan card + base membership tiers).
  let profile: ScanProfile;
  try {
    const result = await callAcrossCredentials(pairs, (c) => researchProfileSmart(c, name));
    profile = normalizeProfile(name, result.value);
  } catch (e) {
    const { message, detail } = friendlyAiError(e);
    return { status: "provider_error", message, detail };
  }

  // 4) Optional: publicly announced events with real sources.
  let events: ScanEvent[] = [];
  if (opts.includeEvents) {
    try {
      const result = await callAcrossCredentials(pairs, (c) => researchEventsSmart(c, name));
      events = normalizeEvents(result.value);
    } catch {
      events = []; // research is optional — never fail the whole scan for events
    }
  }

  return {
    status: "ok",
    result: {
      identity,
      profile,
      events,
      duplicateOf,
    },
  };
}