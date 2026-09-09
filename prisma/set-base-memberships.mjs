// Migration script: normalizes every celebrity community to the two paid base
// membership levels (LEVEL 1 = Premium $1,000, LEVEL 2 = VIP $1,700) and
// removes the deleted free tier / legacy base tiers. Idempotent — safe to run
// repeatedly. Premium "Signature Experience" tiers ($2,500+) are untouched.
//
//   node prisma/set-base-memberships.mjs
//
// Loads DATABASE_URL / MIGRATION_DATABASE_URL from the project .env (Prisma
// reads MIGRATION_DATABASE_URL for the "direct" connection if set, otherwise
// DATABASE_URL). Also runs automatically as part of `npm run build` so every
// Vercel deploy keeps the live database in sync.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { upsertBaseMemberships } from "./base-levels.mjs";

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

  let deleted = 0;
  let created = 0;
  let updated = 0;
  for (const celebrity of celebrities) {
    const result = await upsertBaseMemberships(prisma, celebrity);
    deleted += result.deleted;
    created += result.created;
    updated += result.updated;
    console.log(
      `  ${celebrity.slug}  (${celebrity.name})  -${result.deleted}  +${result.created}  ~${result.updated}`
    );
  }

  console.log(
    `\nBase levels normalized for ${celebrities.length} celebrities in ${Date.now() - started}ms.`
  );
  console.log(
    `Deleted free/legacy base tiers: ${deleted}. Premium & VIP upserted: +${created} (new), ~${updated} (updated).`
  );
  console.log("Run again any time — levels are updated in place.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });