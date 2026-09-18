/**
 * Reliable profile-class system that decides which feature set a person's
 * profile uses — never inferred from who is "famous".
 *
 * THREE classes:
 *   entertainment — CelebrityPass fan system (fan cards, fan membership tiers,
 *                   fan chat). This is the ONLY class that uses the fan system.
 *   business      — factual business/investment info backed by verified sources.
 *   political     — public/official info; investment info only if separately
 *                   verified, legitimate activity exists.
 *
 * The stored, admin-controlled value is `Celebrity.profileType`. The category
 * merely *suggests* its class at creation time; admins keep final control so a
 * "president of a fan club" is never classified as a world leader, etc.
 */

export type ProfileClass = "entertainment" | "business" | "political";

export const PROFILE_TYPES: ReadonlyArray<{ value: ProfileClass; label: string }> = [
  { value: "entertainment", label: "Entertainment (CelebrityPass)" },
  { value: "business", label: "Business / Investor" },
  { value: "political", label: "Political / Government" },
];

export const PROFILE_TYPE_LABELS: Record<ProfileClass, string> = {
  entertainment: "Entertainment",
  business: "Business / Investor",
  political: "Political",
};

export const PROFILE_TYPE_VALUES: ProfileClass[] = [
  "entertainment",
  "business",
  "political",
];

/** Shown/returned when a profile does not run the CelebrityPass fan system. */
export const FAN_SYSTEM_OFF_MESSAGE =
  "This profile does not offer the CelebrityPass fan program.";

export function normalizeProfileType(
  raw: string | null | undefined,
): ProfileClass {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "business" || value === "investor") return "business";
  if (value === "political" || value === "government") return "political";
  return "entertainment";
}

/** Canonical, admin-pickable categories grouped by the class they suggest. */
export const CATEGORY_OPTIONS: Record<ProfileClass, readonly string[]> = {
  entertainment: [
    "Actor",
    "Actress",
    "Singer",
    "Musician",
    "Rapper",
    "Comedian",
    "Athlete",
    "Creator",
    "Influencer",
    "Artist",
    "Dancer",
    "Model",
    "TV Presenter",
  ],
  business: [
    "Entrepreneur",
    "CEO",
    "Businessperson",
    "Investor",
    "Company Founder",
    "Business Leader",
    "Venture Capitalist",
    "Chairman",
  ],
  political: [
    "President",
    "Prime Minister",
    "Chancellor",
    "Government Official",
    "Politician",
    "Senator",
    "Governor",
    "Minister",
    "Diplomat",
  ],
};

export const ALL_CATEGORIES: readonly string[] = (
  Object.values(CATEGORY_OPTIONS) as readonly (readonly string[])[]
).flat();

/** Heuristic fallback that suggests a class from a free-text category. */
export function suggestProfileType(category: string | null | undefined): ProfileClass {
  const raw = String(category ?? "").toLowerCase();
  if (
    /entrepreneur|ceo|founder|chairman|business|investor|capitalist|executive|industrialist|financier|banker|owner|venture|director|president\s*(&|and)?\s*ceo|owner/.test(
      raw,
    )
  ) {
    return "business";
  }
  if (
    /president|prime minister|chancellor|senator|governor|minister|politician|diplomat|congress|congresswoman|congressman|assembly|mayor|official|embassador|ambassador|secretary of state|mp\b/.test(
      raw,
    )
  ) {
    return "political";
  }
  return "entertainment";
}

/** Canonicalize a (possibly legacy, free-text) category for display/scanning. */
export function normalizeCategory(
  value: string | null | undefined,
): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const hit = ALL_CATEGORIES.find(
    (c) => c.toLowerCase() === lower || lower.startsWith(c.toLowerCase()),
  );
  return hit ?? raw;
}