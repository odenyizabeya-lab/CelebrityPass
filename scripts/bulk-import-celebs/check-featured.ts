// Check which of the requested 12 exist in the DB and their isFeatured state.
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

const NAMES = [
  "Johnny Depp", "Donald Trump", "Elon Musk", "Vladimir Putin", "Xi Jinping", "Mark Zuckerberg",
  "Tom Cruise", "Leonardo DiCaprio", "Brad Pitt", "Dwayne Johnson", "Jennifer Lopez", "Sandra Bullock",
];
const key = (n: string) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });
  for (const name of NAMES) {
    const c = await prisma.celebrity.findUnique({
      where: { nameKey: key(name) },
      select: { name: true, nameKey: true, slug: true, category: true, isFeatured: true, profileImage: true, country: true },
    });
    if (!c) {
      console.log(`${name.padEnd(18)} | MISSING`);
    } else {
      console.log(`${c.name.padEnd(18)} | ${String(c.category).padEnd(12)} | featured=${c.isFeatured ? "Y" : "N"} | photo=${String(c.profileImage).startsWith("data:image") ? "Y" : "N"} | ${String(c.country).padEnd(16)} | /${c.slug}`);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});