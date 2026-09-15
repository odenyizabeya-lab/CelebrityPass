/**
 * Standard base membership tiers for every community. There is no free tier;
 * every fan card membership is a paid level — LEVEL 1 = Silver ($200),
 * LEVEL 2 = Gold ($350), LEVEL 3 = Platinum ($500), LEVEL 4 = Premium ($1,000),
 * LEVEL 5 = VIP ($1,700). The shared premium "$2,500+" Experience ladder is
 * applied separately by prisma/premium-levels.mjs at create time.
 *
 * Shared by:
 *   - src/lib/ai/scanner.ts  (fallback when Gemini returns fewer/garbage tiers)
 *   - src/app/api/celebrities/route.ts  (server-side creation on add, so a new
 *     community NEVER ships with only premium tiers even if the admin screen's
 *     background save is interrupted)
 */
export type BaseMembershipTier = { name: string; description: string; price: number | null; currency: string };

export const BASE_MEMBERSHIP_TIERS: BaseMembershipTier[] = [
  {
    name: "Silver",
    description: "Official digital fan card membership — no meeting included.",
    price: 200,
    currency: "USD",
  },
  {
    name: "Gold",
    description: "Premium fan card with priority community news and recognition.",
    price: 350,
    currency: "USD",
  },
  {
    name: "Platinum",
    description: "Top-tier digital fan card with exclusive content and recognition.",
    price: 500,
    currency: "USD",
  },
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

function asString(v: unknown, max: number, fallback = ""): string {
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t.slice(0, max) : fallback;
  }
  return fallback;
}

/**
 * Turn arbitrary admin/AI input into a clean array of at most 5 base tiers, one
 * per slot. Any missing/invalid slot inherits the standard Silver→VIP default,
 * so the payload that reaches the DB is always sane regardless of source.
 */
export function sanitizeBaseMemberships(raw: unknown): BaseMembershipTier[] {
  const max = BASE_MEMBERSHIP_TIERS.length;
  if (!Array.isArray(raw) || raw.length === 0) {
    return BASE_MEMBERSHIP_TIERS.map((t) => ({ ...t }));
  }
  return raw.slice(0, max).map((m, i) => {
    const def = BASE_MEMBERSHIP_TIERS[i];
    const o = (m ?? {}) as Record<string, unknown>;
    return {
      name: asString(o.name, 60, def?.name ?? "Silver"),
      description: asString(o.description, 300, def?.description ?? "Fan membership tier."),
      price:
        typeof o.price === "number" && Number.isFinite(o.price) && o.price > 0
          ? o.price
          : (def?.price ?? 200),
      currency: asString(o.currency, 4, "USD"),
    };
  });
}