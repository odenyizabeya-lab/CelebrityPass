// Shared types for the Automatic Celebrity Scanner.
// The scanner runs server-side only (admin-authed) and returns a payload that
// the REAL admin celebrity form consumes for review. Nothing here touches the
// database schema — all prepared data maps onto existing Celebrity /
// MembershipLevel / CelebrityEvent fields.

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

export type ScanProfile = {
  /** Display name exactly as the celebrity is commonly known. */
  name: string;
  aliases: string[] | null;
  /** One of: Actor | Musician | Athlete | Creator | Public Figure | Artist */
  category: string;
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

export type ScanOutcome =
  | { status: "ok"; result: ScanResult }
  | { status: "low_confidence"; identity: IdentifiedPerson }
  | { status: "provider_error"; message: string; detail?: string };