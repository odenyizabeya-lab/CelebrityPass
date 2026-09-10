// One-time backfill: (re)build the Google-style knowledge panel for EVERY
// existing celebrity and store it in `Celebrity.googleInfo`. Runs the real
// runtime engine (google-info.ts) so the data is byte-for-byte the same as a
// live page load. Fetches live from Wikipedia/Wikidata (+ Deezer for album art)
// with `force: true` — the panel data is the only source of biographical text
// on profiles now (the manual bios were removed permanently).
//
// Run: node prisma/backfill-knowledge-panel.mjs
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { fetchGoogleInfo } from "../src/lib/google-info.ts";

// Minimal .env loader so this works when run directly with node.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const rows = await prisma.celebrity.findMany({
    select: { id: true, name: true, profession: true, category: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`celebrities: ${rows.length}`);

  let ok = 0;
  let none = 0;
  for (const row of rows) {
    process.stdout.write(`  ${row.name} -> `);
    try {
      const info = await fetchGoogleInfo(row.name, {
        force: true,
        profession: row.profession,
        category: row.category,
      });
      if (info) {
        await prisma.celebrity.update({ where: { id: row.id }, data: { googleInfo: JSON.stringify(info) } });
        ok += 1;
        console.log(`ok (age=${info.age ?? "?"}, kind=${info.kind}, works=${info.works.length}, images=${info.images.length})`);
      } else {
        none += 1;
        console.log("no reliable source");
      }
    } catch (e) {
      none += 1;
      console.log(`error: ${e instanceof Error ? e.message : String(e)}`);
    }
    // Gentle pacing — be polite to the public Wikipedia/Wikidata/Deezer APIs.
    await sleep(600);
  }

  console.log(`\nDone. ${ok} refreshed, ${none} skipped (no reliable source).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());