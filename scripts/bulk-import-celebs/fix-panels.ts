// One-off: fetch knowledge panels for celebrities whose bare-name lookup
// collided or found nothing (e.g. Pink -> the color, Drake -> ambiguous) using
// disambiguated article titles, and store googleInfo. Idempotent.
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

const DRY = process.env.BULK_DRY !== "0";

const TARGETS: Array<{ nameKey: string; query: string; profession: string; category: string }> = [
  { nameKey: "pink", query: "Pink (singer)", profession: "singer", category: "Musician" },
  { nameKey: "drake", query: "Drake (musician)", profession: "musician", category: "Musician" },
];

async function main() {
  const { prisma } = await import("../../src/lib/db.ts");
  const { fetchGoogleInfo } = await import("../../src/lib/google-info.ts");
  for (const t of TARGETS) {
    const celeb = await prisma.celebrity.findUnique({
      where: { nameKey: t.nameKey },
      select: { id: true, name: true, googleInfo: true },
    });
    if (!celeb) {
      console.log(`${t.nameKey}: not found in DB — skipping`);
      continue;
    }
    if (celeb.googleInfo) {
      console.log(`${celeb.name}: panel already present — skipping`);
      continue;
    }
    const info = await fetchGoogleInfo(t.query, { force: true, profession: t.profession, category: t.category });
    if (!info) {
      console.log(`${celeb.name}: panel fetch failed — leaving as-is`);
      continue;
    }
    console.log(`${celeb.name}: "${info.description}" | ${info.overview?.slice(0, 110)}`);
    console.log(`   image: ${info.image?.url ?? "(none)"}`);
    if (!DRY) {
      await prisma.celebrity.update({ where: { id: celeb.id }, data: { googleInfo: JSON.stringify(info) } });
      console.log("   googleInfo saved.");
    } else {
      console.log("   DRY-RUN — googleInfo NOT saved.");
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});