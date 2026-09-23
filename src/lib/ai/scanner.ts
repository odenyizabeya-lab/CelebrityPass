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
import { BASE_MEMBERSHIP_TIERS } from "@/lib/memberships";
import { getAIModel, getGeminiKeys, getGeminiKeyHealth } from "./settings";
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
  ScanDiagnostics,
  ScanEvent,
  ScanInvestor,
  ScanOutcome,
  ScanProfile,
} from "./types";
import {
  normalizeCategory,
  normalizeProfileType,
} from "@/lib/profiles/classes";

/** Safe category: force any AI output into the platform's canonical set. */
export function normalizeInvestor(raw: unknown): ScanInvestor | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const verified = r.verified === true;
  const sector = asString(r.sector, 120) || null;
  const overview = asString(r.overview, 1500) || null;
  const ventures = asString(r.ventures, 1200) || null;
  const opportunities = asString(r.opportunities, 1200) || null;
  const eligibility = asString(r.eligibility, 800) || null;
  const risks = asString(r.risks, 800) || null;
  const disclaimer = asString(r.disclaimer, 800) || null;
  const rawSources = Array.isArray(r.sources) ? r.sources : [];
  const sources = rawSources
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      label: asString(s.label, 140),
      url: asString(s.url, 500),
      date: typeof s.date === "string" && s.date.trim() ? s.date.trim().slice(0, 60) : null,
    }))
    .filter((s) => s.label && /^https?:\/\//i.test(s.url))
    .slice(0, 8);
  // Only a meaningful, person-specific result survives; empty/unverified with no
  // content stays null so the page says "no verified offering found" honestly.
  if (!verified && !overview && !ventures && !opportunities) return null;
  return {
    enabled: false, // never auto-published — an admin explicitly enables it
    verified,
    sector,
    overview,
    ventures,
    opportunities,
    eligibility,
    risks,
    disclaimer,
    sources,
  };
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
 * Standard base membership tiers live in src/lib/memberships.ts — shared with
 * the create route so a new community always ships with the full Silver→VIP set
 * even if the admin form's background save is interrupted.
 */

type RawProfileSchema = Awaited<ReturnType<typeof researchProfile>>;
type RawEventsSchema = Awaited<ReturnType<typeof researchEvents>>;

/** Maps a raw Gemini profile into the exact ScanProfile type. */
export function normalizeProfile(name: string, raw: RawProfileSchema): ScanProfile {
  const membership =
    Array.isArray(raw.base_memberships) && raw.base_memberships.length >= 5
      ? raw.base_memberships.slice(0, 5)
      : BASE_MEMBERSHIP_TIERS;

  const cleanMembership = membership
    .map((m, i) => ({
      name: asString(m?.name, 60) || BASE_MEMBERSHIP_TIERS[i]?.name || "Silver",
      description: asString(m?.description, 300) || "Fan membership tier.",
      price:
        typeof m?.price === "number" && Number.isFinite(m.price) && m.price > 0
          ? m.price
          : (BASE_MEMBERSHIP_TIERS[i]?.price ?? 200),
      currency: asString(m?.currency, 4) || "USD",
    }))
    .slice(0, 5);

  // The verified profile class drives which feature system this page uses:
  // entertainment = CelebrityPass fan system; business/political = factual
  // profiles (fan system OFF). The class is authoritative over the AI's raw
  // flags so a "rich actor" is never misclassified as business just for being
  // wealthy, and a head of state is never given a fan-card page.
  const profileType = normalizeProfileType(raw.profile_type);
  const fansCardEnabled = profileType === "entertainment";

  return {
    name: asString(raw.name, 120) || name,
    aliases: asArray(raw.aliases).slice(0, 8),
    category: normalizeCategory(raw.category) ?? "Public Figure",
    profileType,
    fansCardEnabled,
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
    // Person-specific business/investment info — entertainment (fan-system)
    // profiles never carry investor content, so the two systems stay separate.
    investorProfile: profileType === "entertainment" ? null : normalizeInvestor(raw.investor_profile),
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
 *
 * Once a scan observes a quota error it stops attempting grounded calls for
 * the rest of that scan (they only burn more quota on a key that is already
 * squeezed) and goes straight to the ungrounded path.
 */
type ScanQuotaWatch = { quotaSeen: boolean };

async function researchProfileSmart(c: GeminiCredential, name: string, w: ScanQuotaWatch): Promise<RawProfileSchema> {
  try {
    return await researchProfile(c, name, !w.quotaSeen);
  } catch (e) {
    if (e instanceof AiCallError && ["unsupported_combination", "quota", "billing", "model"].includes(e.type)) {
      if (e.type === "quota") w.quotaSeen = true;
      return await researchProfile(c, name, false);
    }
    throw e;
  }
}

async function researchEventsSmart(c: GeminiCredential, name: string, w: ScanQuotaWatch): Promise<RawEventsSchema> {
  try {
    return await researchEvents(c, name, !w.quotaSeen);
  } catch (e) {
    if (e instanceof AiCallError && ["unsupported_combination", "quota", "billing", "model"].includes(e.type)) {
      if (e.type === "quota") w.quotaSeen = true;
      return await researchEvents(c, name, false);
    }
    throw e;
  }
}

/** Key-level failures that are permanent (config can't fix at scan time). */
const PERMANENT_BLOCK_KINDS = new Set([
  "invalid_key",
  "api_disabled",
  "billing",
  "project_restriction",
  "permission",
  "denied",
]);

/** Build the ordered credential chain from DB settings + env (best key first). */
async function credentialChain(): Promise<{ pairs: GeminiCredential[]; diagnostics: ScanDiagnostics }> {
  const model = await getAIModel();
  const keys = await getGeminiKeys();
  const sources: { key: string; label: string }[] = [];
  if (keys.primary) sources.push({ key: keys.primary, label: keys.primarySource === "db" ? "Primary key (database)" : "GEMINI_API_KEY env" });
  if (keys.backup) sources.push({ key: keys.backup, label: keys.backupSource === "db" ? "Backup key (database)" : "GEMINI_BACKUP_API_KEY env" });
  if (process.env.GEMINI_API_KEY?.trim()) sources.push({ key: process.env.GEMINI_API_KEY.trim(), label: "GEMINI_API_KEY env" });
  if (process.env.GEMINI_BACKUP_API_KEY?.trim()) sources.push({ key: process.env.GEMINI_BACKUP_API_KEY.trim(), label: "GEMINI_BACKUP_API_KEY env" });

  // Preflight-probe each configured key (a tiny real generation) and drop keys
  // with a permanent block from the chain so one dead key never produces a slow,
  // confusing 403 at the start of every scan. Quota/slow keys stay in the chain
  // (the existing retry/rollover logic handles those).
  const skipped: ScanDiagnostics["skipped"] = [];
  try {
    const health = await getGeminiKeyHealth();
    const blocked = health.filter((h) => !h.result?.ok && PERMANENT_BLOCK_KINDS.has(h.result?.kind ?? ""));
    const blockedKeys = new Set(blocked.map((h) => h.key));
    const reasonFor = new Map(blocked.map((h) => [h.key, h.result?.kind ?? "blocked"]));
    const kept = sources.filter((s) => {
      if (blockedKeys.has(s.key)) {
        skipped.push({ label: s.label, reason: reasonFor.get(s.key) ?? "blocked" });
        return false;
      }
      return true;
    });
    sources.length = 0;
    sources.push(...kept);
  } catch {
    // Health probe failed (network/cache) — fall back to the full chain.
  }

  return { pairs: buildCredentialChain(sources, model), diagnostics: { used: null, skipped } };
}

/**
 * Runs the full scan for one uploaded image.
 * Returns an error-free outcome the API route serializes for admin review.
 */
export async function runCelebrityScan(imageDataUri: string, opts: { includeEvents?: boolean } = {}): Promise<ScanOutcome> {
  const { pairs, diagnostics } = await credentialChain();
  if (pairs.length === 0) {
    return {
      status: "provider_error",
      message: "No working Gemini API key is configured yet. Open Admin → AI Settings to add a fresh key, or set GEMINI_API_KEY.",
      detail: diagnostics.skipped.length
        ? `All configured keys are blocked by Google (${diagnostics.skipped.map((s) => s.label).join(", ")}). Create a NEW key from a DIFFERENT Google account/project and add it in Admin → AI Settings.`
        : "Open Admin → AI Settings to add your key, or set GEMINI_API_KEY.",
      diagnostics,
    };
  }

  // 1) Identify the person in the image.
  let identity: IdentifiedPerson;
  try {
    const identified = await callAcrossCredentials(pairs, (c) => identifyPerson(c, imageDataUri));
    diagnostics.used = { label: identified.used.label, model: identified.used.model };
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
    return { status: "provider_error", message, detail, diagnostics };
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

  // 3) Research the profile (facts + fan card + base membership tiers) and the
  //    optional public events in PARALLEL — both only depend on the identified
  //    name, so the scan never waits for two grounded round-trips back-to-back
  //    and stays inside the platform function's time budget even when live
  //    web-search grounding is slow.
  let profile: ScanProfile;
  let events: ScanEvent[] = [];
  const quotaWatch: ScanQuotaWatch = { quotaSeen: false };
  try {
    const [profileValue, eventsValue] = await Promise.all([
      callAcrossCredentials(pairs, (c) => researchProfileSmart(c, name, quotaWatch)).then((r) => r.value),
      opts.includeEvents
        ? callAcrossCredentials(pairs, (c) => researchEventsSmart(c, name, quotaWatch))
            .then((r) => r.value)
            .catch(() => null) // events are optional — one never fails the scan
        : Promise.resolve(null),
    ]);
    profile = normalizeProfile(name, profileValue);
    events = eventsValue ? normalizeEvents(eventsValue) : [];
  } catch (e) {
    // Only the profile is mandatory; its failure (or a fully exhausted
    // credential chain) aborts the scan with an honest, friendly message.
    const { message, detail } = friendlyAiError(e);
    return { status: "provider_error", message, detail, diagnostics };
  }

  return {
    status: "ok",
    result: {
      identity,
      profile,
      events,
      duplicateOf,
    },
    diagnostics,
  };
}

export type CommunityByImageOutcome =
  | { status: "found"; community: { id: string; slug: string; name: string } }
  | { status: "not_identified"; reason: string | null; bestName: string | null }
  | { status: "not_found"; name: string | null }
  | { status: "provider_error"; message: string; detail?: string };

/**
 * Public visual search: identify the person in a photo (real Gemini vision),
 * then look up whether they already have a CelebrityPass community. Never
 * fabricates — an unrecognized/uncertain face or a missing community returns a
 * clear "not found" outcome the UI can explain honestly.
 */
export async function searchCommunityByImage(imageDataUri: string): Promise<CommunityByImageOutcome> {
  const { pairs, diagnostics } = await credentialChain();
  if (pairs.length === 0) {
    return {
      status: "provider_error",
      message: "No working Gemini API key is configured. Ask the site owner to add a fresh key in Admin → AI Settings.",
      detail: diagnostics.skipped.length
        ? `All configured keys are blocked by Google (${diagnostics.skipped.map((s) => s.label).join(", ")}).`
        : undefined,
    };
  }

  let identity: IdentifiedPerson;
  try {
    const identified = await callAcrossCredentials(pairs, (c) => identifyPerson(c, imageDataUri));
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
    return { status: "not_identified", reason: identity.reason, bestName: identity.bestName };
  }

  const community = await findExistingCommunity(identity.bestName);
  if (community) return { status: "found", community };
  return { status: "not_found", name: identity.bestName };
}