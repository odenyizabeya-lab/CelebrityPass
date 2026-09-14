// The five paid base membership levels shared by every celebrity community:
//   LEVEL 1 = Silver    ($200)  — Official fan card, digital perks only.
//   LEVEL 2 = Gold      ($350)  — Premium fan card + priority community news.
//   LEVEL 3 = Platinum  ($500)  — Top-tier fan card, exclusive content + recognition.
//   LEVEL 4 = Premium ($1,000)  — Premium fan card membership with community perks.
//   LEVEL 5 = VIP    ($1,700)  — VIP fan card membership with top-tier community status.
//
// There is NO free membership tier. These are the fan-card tiers below the
// premium "Signature Experience" ladder ($2,500+), which is never touched here.
// No tier in this section promises an in-person meeting or event access.
//
// The {name} placeholder is replaced per tier description where needed.

export const BASE_LEVELS = [
  {
    name: "Silver",
    price: 200,
    tagline: "Official fan card with digital community perks — no meeting included.",
    benefits: [
      "Official digital fan card for {name}",
      "Unique verified Fan ID",
      "Live card link + QR code",
      "Community news and fan-only updates",
      "No in-person meeting or event access is included",
    ],
  },
  {
    name: "Gold",
    price: 350,
    tagline: "Premium fan card with priority content and community recognition.",
    benefits: [
      "Everything in Silver, plus:",
      "Exclusive Gold card design",
      "Priority community news and alerts",
      "Early access to digital content",
      "Special recognition badge",
      "No in-person meeting or event access is included",
    ],
  },
  {
    name: "Platinum",
    price: 500,
    tagline: "Top-tier fan card with full community status — the highest digital-only tier.",
    benefits: [
      "Everything in Gold, plus:",
      "Exclusive Platinum card design",
      "Top-tier community status and badge",
      "Premium support access",
      "Full exclusive digital content library",
      "No in-person meeting or event access is included",
    ],
  },
  {
    name: "Premium",
    price: 1000,
    tagline: "Premium fan card membership with exclusive community perks.",
    benefits: [
      "Official digital fan card for {name}",
      "Unique verified Fan ID",
      "Live card link + QR code",
      "Priority community news",
      "Exclusive digital content",
    ],
  },
  {
    name: "VIP",
    price: 1700,
    tagline: "VIP fan card membership with top-tier community status.",
    benefits: [
      "Everything in Premium, plus:",
      "Exclusive VIP card design",
      "Premium support",
      "Special recognition badge",
      "Top-tier community status",
    ],
  },
];

// Any level priced below this amount is a base fan-card tier. The premium
// "Signature Experience" ladder starts at or above this amount.
export const BASE_PRICE_MAX = 2500;

/**
 * Normalizes every base membership tier for one celebrity to the five paid
 * standard levels above. Idempotent — safe to run any number of times.
 *
 * - Deletes legacy base tiers (the free tier and any old paid base tiers
 *   priced below the premium ladder) unless they are named Silver, Gold,
 *   Platinum, Premium or VIP.
 * - Upserts all five base levels in place.
 *
 * Premium tiers ($2,500+) are never created, updated or deleted by this
 * function — they are handled by upsertPremiumLevels() in premium-levels.mjs.
 */
export async function upsertBaseMemberships(prisma, celebrity) {
  const keepNames = BASE_LEVELS.map((b) => b.name);

  const del = await prisma.membershipLevel.deleteMany({
    where: {
      celebrityId: celebrity.id,
      name: { notIn: keepNames },
      OR: [{ price: { lt: BASE_PRICE_MAX } }, { price: null }],
    },
  });

  let created = 0;
  let updated = 0;
  for (let i = 0; i < BASE_LEVELS.length; i++) {
    const b = BASE_LEVELS[i];
    const levelData = {
      celebrityId: celebrity.id,
      name: b.name,
      description: b.tagline,
      benefits: b.benefits.map((line) => line.replaceAll("{name}", celebrity.name)).join("\n"),
      price: b.price,
      currency: "USD",
      displayOrder: i,
      isActive: true,
    };
    const existing = await prisma.membershipLevel.findFirst({
      where: { celebrityId: celebrity.id, name: b.name },
    });
    if (existing) {
      await prisma.membershipLevel.update({ where: { id: existing.id }, data: levelData });
      updated += 1;
    } else {
      await prisma.membershipLevel.create({ data: levelData });
      created += 1;
    }
  }

  return { deleted: del.count, created, updated };
}