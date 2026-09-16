// Verify a bulk-imported batch is complete: DB fields + profile completeness.
// Reads the names list from BULK_NAMES (like import-celebs) or a passed file arg.
import { PrismaClient } from "@prisma/client";
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
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
if (process.env.MIGRATION_DATABASE_URL) process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;

const NAMES_FILE = process.argv[2] ? path.resolve(ROOT, process.argv[2]) : (process.env.BULK_NAMES ? path.resolve(ROOT, process.env.BULK_NAMES) : path.join(SCRIPT_DIR, "names.txt"));
const NAMES = readFileSync(NAMES_FILE, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const isReal = (u: string | null) => !!u && /^data:image\/(jpeg|png|webp);/i.test(u);

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });
  const keys = new Set(NAMES.map((n) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")));
  const celebs = await prisma.celebrity.findMany({
    where: { nameKey: { in: [...keys] } },
    select: {
      slug: true, name: true, nameKey: true, category: true, country: true, bio: true,
      googleInfo: true, profileImage: true, imageSource: true, imageVerified: true,
      website: true, instagramUrl: true, facebookUrl: true, tiktokUrl: true, googleUrl: true,
      displayFanCount: true, isActive: true, isVerified: true,
      memberships: { select: { name: true }, orderBy: { displayOrder: "asc" } },
    },
  });
  const missing = NAMES.filter((n) => !celebs.some((c) => c.nameKey === n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")));
  console.log(`matched ${celebs.length}/${NAMES.length}; missing: ${missing.join(", ") || "none"}`);
  let bad = 0;
  for (const c of celebs) {
    const panel = !!(c.googleInfo && JSON.parse(c.googleInfo as string)?.overview);
    const tierNames = c.memberships.map((m) => m.name).join(",");
    const ok = c.country && c.bio && panel && isReal(c.profileImage) && c.displayFanCount != null && tierNames.includes("Silver") && tierNames.includes("Gold") && c.isActive;
    if (!ok) bad++;
    console.log(
      `${c.name.padEnd(18)} | ${String(c.category).padEnd(12)} | ${String(c.country).slice(0, 16).padEnd(16)} | img=${isReal(c.profileImage) ? "Y" : "N"}(${c.imageSource ?? "-"}) | panel=${panel ? "Y" : "N"} | links=${[c.website, c.instagramUrl, c.facebookUrl, c.tiktokUrl, c.googleUrl].filter(Boolean).length}/5 | fans=${c.displayFanCount ?? "-"} | verify=${c.isVerified ? "Y" : "N"} | /celebrity/${c.slug}`,
    );
  }
  console.log(`\nincomplete profiles: ${bad}/${celebs.length}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});