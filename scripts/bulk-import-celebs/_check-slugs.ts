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
(async () => {
  const rows = await prisma.celebrity.findMany({ where: { name: { in: ["Brooks & Dunn", "Daniel Brühl", "LEA", "Silbermond", "Stefanie Kloß"] } }, select: { name: true, nameKey: true, slug: true, country: true, bio: true } });
  for (const r of rows) console.log(`${r.name} | slug=${r.slug} | key=${r.nameKey} | country=${r.country ?? "-"} | bio=${r.bio ? r.bio.slice(0, 60).replace(/\n/g, " ") + "…" : "NONE"}`);
  await prisma.$disconnect();
})();