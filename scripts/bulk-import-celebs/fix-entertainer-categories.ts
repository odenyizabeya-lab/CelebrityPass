// One-off: correct obvious category mislabels in the entertainer batch. The
// import's kind-detection reads Wikidata occupations, so actor-musicians land in
// the wrong bucket (Hugh Grant with a "musician" occupation claim etc.). Only
// unambiguous fixes — primary field on this platform.
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
const DRY = process.env.BULK_DRY !== "0";

const CATEGORIES: Record<string, string> = {
  "Shah Rukh Khan": "Actor",
  "Nicole Kidman": "Actor",
  "Anne Hathaway": "Actor",
  "Hugh Jackman": "Actor",
  "Robert Pattinson": "Actor",
  "Hugh Grant": "Actor",
  "Ryan Gosling": "Actor",
  "Zendaya": "Actor",
  "Drake": "Musician",
  "Pink": "Musician",
};

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });
  for (const [name, category] of Object.entries(CATEGORIES)) {
    const key = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const c = await prisma.celebrity.findUnique({ where: { nameKey: key }, select: { id: true, name: true, category: true } });
    if (!c) {
      console.log(`${name}: NOT FOUND`);
      continue;
    }
    console.log(`${c.name}: ${c.category} -> ${category}`);
    if (!DRY) await prisma.celebrity.update({ where: { id: c.id }, data: { category } });
  }
  console.log(DRY ? "DRY-RUN — set BULK_DRY=0 to apply" : "categories fixed");
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});