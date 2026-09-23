// Shared types for the Automatic Celebrity Scanner.
// The scanner runs server-side only (admin-authed) and returns a payload that
// the REAL admin celebrity form consumes for review. Nothing here touches the
// database schema — all prepared data maps onto existing Celebrity /
// MembershipLevel / CelebrityEvent fields.

import type { ProfileClass } from "@/lib/profiles/classes";

export type IdentifiedPerson = {
  identified: boolean;
  bestName: string | null;
  names: string[];
  confidence: "high" | "low";
  reason: string | null;
};

export type SocialHandles = {
  /** Verified official page only — never a fan page or impersonator. */
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  /** Verified Google presence / Knowledge Panel result for this exact celebrity. */
  google: string | null;
};

export type CardinalFollowers = {
  instagram: number | null;
  tiktok: number | null;
  facebook: number | null;
};

export type PrepMembershipTier = {
  name: string;
  description: string;
  price: number | null;
  currency: string;
};

/**
 * Person-specific business/investment info the research found FOR THIS ONE
 * PERSON. Saved strictly under their own profile id — never shared, copied, or
 * blended with another person's info. Only verified, sourced facts are kept;
 * offerings/minimums/returns are never invented.
 */
export type ScanInvestor = {
  /** Whether the section may be shown publicly (never auto-true from raw input). */
  enabled: boolean;
  /** Whether the research confirmed the facts against authoritative sources. */
  verified: boolean;
  sector: string | null;
  overview: string | null;
  ventures: string | null;
  opportunities: string | null;
  eligibility: string | null;
  risks: string | null;
  disclaimer: string | null;
  sources: { label: string; url: string; date: string | null }[];
};

export type ScanProfile = {
  /** Display name exactly as the celebrity is commonly known. */
  name: string;
  aliases: string[] | null;
  /** One of the canonical categories (see src/lib/profiles/classes.ts). */
  category: string;
  /** Verified profile class: entertainment (Fan system) | business | political. */
  profileType: ProfileClass;
  /** Whether this person's page runs the CelebrityPass fan system. */
  fansCardEnabled: boolean;
  profession: string;
  country: string;
  city: string | null;
  website: string | null;
  /** 6-digit hex accent used by the existing theme (e.g. "#8b5cf6"). */
  accentColor: string;
  socials: SocialHandles;
  /** Published follower counts if they were verified by the research — else null. */
  followers: CardinalFollowers;
  /** Fan-card design fields already used by CardDesign. */
  cardDesign: {
    badgeText: string | null;
    watermark: string | null;
    accent: string | null;
  };
  /** Exactly 2 prepared base membership tiers (paid Premium / VIP standard). */
  baseMemberships: PrepMembershipTier[];
  /** Person-specific investment/business info, or null when none is verified. */
  investorProfile: ScanInvestor | null;
  /** Public source URLs the research actually used (evidence trail). */
  sourceUrls: string[];
};

export type ScanEvent = {
  name: string;
  /** Must be one of the existing EVENT_TYPES. */
  type: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  /** ISO date (YYYY-MM-DD). */
  startDate: string;
  /** HH:MM 24h in the venue's local time. */
  startTime: string | null;
  timezone: string | null;
  officialUrl: string | null;
  /** Required — the public source the model verified the event from. */
  sourceUrl: string | null;
};

export type ScanResult = {
  identity: IdentifiedPerson;
  profile: ScanProfile | null;
  /** Publicly announced events, each with a real source URL. Marked UNVERIFIED. */
  events: ScanEvent[];
  /** When the identified person already has a live community here. */
  duplicateOf: { id: string; slug: string; name: string } | null;
};

export type ScanDiagnostics = {
  /** Credential that actually served the scan (masked hint — never the key). */
  used: { label: string; model: string } | null;
  /** Keys that were probed at scan start and skipped because they are blocked. */
  skipped: { label: string; reason: string }[];
};

export type ScanOutcome =
  | { status: "ok"; result: ScanResult; diagnostics?: ScanDiagnostics }
  | { status: "low_confidence"; identity: IdentifiedPerson }
  | { status: "provider_error"; message: string; detail?: string; diagnostics?: ScanDiagnostics };