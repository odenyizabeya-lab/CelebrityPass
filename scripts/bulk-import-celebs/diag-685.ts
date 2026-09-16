// Diagnostics: sample original-batch celebrities and report their DB completeness +
// live page/image status. Original = all celebs before the world-leaders import.
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

const prisma = new PrismaClient({ log: ["error"] });

const isReal = (u: string | null) => !!u && /^data:image\/(jpeg|png|webp|svg)/i.test(u);

async function main() {
  const all = await prisma.celebrity.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, slug: true, nameKey: true, category: true, country: true, bio: true,
      googleInfo: true, googleUrl: true, profileImage: true, imageStatus: true, imageVerified: true,
      website: true, instagramUrl: true, facebookUrl: true, tiktokUrl: true, displayFanCount: true,
      isActive: true, createdAt: true,
    },
  });
  console.log(`total in DB: ${all.length}`);

  // The original batch = the 685 imported before the world-leaders run.
  // Latest import created 63 celebs (40 leaders + 23 entertainers) after the base.
  const baseCount = all.length - 63;
  const originals = all.slice(0, baseCount);
  console.log(`originals: ${originals.length} | later batch: ${all.length - baseCount}`);

  const broken: Array<{ name: string; why: string }> = [];
  for (const c of originals) {
    const issues: string[] = [];
    if (!isReal(c.profileImage)) issues.push(`no-img(${c.imageStatus ?? "-"})`);
    if (!c.country) issues.push("no-country");
    if (!c.bio && !c.googleInfo) issues.push("no-bio&no-panel");
    if (!c.displayFanCount) issues.push("no-fans");
    if (!c.isActive) issues.push("inactive");
    if (issues.length) broken.push({ name: c.name, why: issues.join(",") });
  }
  console.log(`\noriginals with any issue: ${broken.length}/${originals.length}`);
  for (const b of broken.slice(0, 60)) console.log(`  - ${b.name}: ${b.why}`);
  if (broken.length > 60) console.log(`  ... and ${broken.length - 60} more`);

  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});