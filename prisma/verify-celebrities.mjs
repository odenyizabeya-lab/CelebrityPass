// Migration script: re-verifies every published (active) celebrity so the
// blue verified badge shows on cards and profiles. Idempotent — safe to run
// repeatedly. This platform treats every published community as auto-verified;
// this repairs rows created by older seeds/imports that predate isVerified.
//
//   node prisma/verify-celebrities.mjs
//
// Reads DATABASE_URL / MIGRATION_DATABASE_URL from the project .env (Prisma
// uses MIGRATION_DATABASE_URL for the "direct" connection if set).
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

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
  const celebrities = await prisma.celebrity.findMany({ select: { id: true, name: true, isVerified: true, isActive: true } });

  let verified = 0;
  let unchanged = 0;
  for (const c of celebrities) {
    if (c.isVerified) {
      unchanged += 1;
      continue;
    }
    await prisma.celebrity.update({ where: { id: c.id }, data: { isVerified: true } });
    verified += 1;
    console.log(`  VERIFY ${c.name}`);
  }

  console.log(`\nVerified ${verified} celebrities in ${Date.now() - started}ms (${unchanged} already verified).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });