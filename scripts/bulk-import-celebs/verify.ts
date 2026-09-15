// Post-import verification for scripts/bulk-import-celebs.
// Checks: celebrity count, duplicate nameKeys, fan-number coverage, knowledge
// panels, base+premium tiers (>=20), then hits the live public API for a
// consistent count. Run: npx tsx scripts/bulk-import-celebs/verify.ts
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..");
try {
  const text = readFileSync(path.join(ROOT, ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    const key = m[1];
    if (!(key in process.env)) process.env[key] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

async function main() {
  const { prisma } = await import("@/lib/db");
  const all = await prisma.celebrity.findMany({
    select: { id: true, name: true, nameKey: true, slug: true, displayFanCount: true, googleInfo: true, isActive: true },
  });
  const namedup = all.length - new Set(all.map((c) => c.nameKey)).size;
  const dupKeys = [...new Map(all.map((c) => [c.nameKey, c.name])).entries()].filter(
    ([k]) => all.filter((c) => c.nameKey === k).length > 1,
  );
  const fanned = all.filter((c) => c.displayFanCount == null).map((c) => c.name);
  const panelNulls = all.filter((c) => !c.googleInfo).map((c) => c.name);
  const tiers = await prisma.membershipLevel.groupBy({ by: ["celebrityId"], _count: true });
  const short = tiers.filter((t) => t._count < 20);
  const empty = all
    .filter((c) => !tiers.some((t) => t.celebrityId === c.id && t._count > 0))
    .map((c) => c.name);

  const out = {
    celebritiesInDb: all.length,
    celebrityIdCount: all.length,
    duplicateNameKeys: namedup,
    duplicateList: dupKeys.map(([, name]) => name),
    noFanNumber: fanned,
    missingPanel: panelNulls,
    membershipsPerCelebrityBelow20: short.length,
    celebritiesWithoutAnyTier: empty,
  };
  console.log(JSON.stringify(out, null, 2));

  // Live public API sanity (the fan app reads these).
  try {
    const r = await globalThis.fetch("https://celebritypass.app/api/celebrities");
    const j = await r.json();
    console.log("live API celebrities:", j?.celebrities?.length, "http", r.status);
  } catch (e) {
    console.log("live API check failed:", String(e));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});