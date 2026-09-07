// One-off script: creates the premium "Experience" tiers ($2,500 – $3,000,000)
// for every celebrity community. Idempotent — safe to run repeatedly.
//
//   node prisma/apply-premium-levels.mjs
//
// Loads DATABASE_URL / MIGRATION_DATABASE_URL from the project .env (Prisma
// reads MIGRATION_DATABASE_URL for the "direct" connection if set, otherwise
// DATABASE_URL).
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { upsertPremiumLevels } from "./premium-levels.mjs";

// Minimal .env loader so this works when run directly with node (Prisma's CLI
// does this automatically, plain node does not).
try {
  const dotenv = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of dotenv.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
} catch {
  // No .env file — rely on already-set environment variables.
}

const prisma = new PrismaClient();

async function main() {
  const started = Date.now();
  const celebrities = await prisma.celebrity.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
  });

  let created = 0;
  let updated = 0;
  for (const celebrity of celebrities) {
    const result = await upsertPremiumLevels(prisma, celebrity);
    created += result.created;
    updated += result.updated;
    console.log(`  ${celebrity.slug}  (${celebrity.name})  +${result.created}  ~${result.updated}`);
  }

  console.log(`\nPremium levels upserted for ${celebrities.length} celebrities in ${Date.now() - started}ms.`);
  console.log(`Created: ${created}, updated: ${updated}. Run again any time — tiers are updated in place.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });