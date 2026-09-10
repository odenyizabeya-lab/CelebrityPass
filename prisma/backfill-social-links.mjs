// One-time backfill: migrate the legacy socialLinks JSON into the four new
// permanent columns (facebookUrl / instagramUrl / tiktokUrl / googleUrl).
// Only copies links that already exist and look like real http(s) URLs.
// Never guesses. googleUrl is left null because the legacy JSON has no Google
// entry and we must never fabricate one.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const isHttp = (u) => typeof u === "string" && /^https?:\/\/.+/i.test(u);

async function main() {
  const rows = await prisma.celebrity.findMany({
    select: { id: true, name: true, socialLinks: true, facebookUrl: true, instagramUrl: true, tiktokUrl: true, googleUrl: true },
  });

  let updated = 0;
  for (const c of rows) {
    let legacy = {};
    try {
      legacy = c.socialLinks ? JSON.parse(c.socialLinks) : {};
    } catch {
      legacy = {};
    }
    const patch = {};
    const map = { facebookUrl: "facebook", instagramUrl: "instagram", tiktokUrl: "tiktok" };
    for (const [col, key] of Object.entries(map)) {
      const existing = c[col];
      const candidate = legacy[key];
      if (!existing && isHttp(candidate)) patch[col] = candidate;
    }
    if (Object.keys(patch).length > 0) {
      await prisma.celebrity.update({ where: { id: c.id }, data: patch });
      updated += 1;
      console.log(`[migrated] ${c.name}: ${JSON.stringify(patch)}`);
    }
  }
  console.log(`\nDone. Migrated ${updated} of ${rows.length} celebrities (googleUrl untouched — never guessed).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());