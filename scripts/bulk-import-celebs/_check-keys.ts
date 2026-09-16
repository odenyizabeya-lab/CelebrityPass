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
  const rows = await prisma.celebrity.findMany({
    where: { name: { in: ["Johann von Bülow", "Stefanie Kloß", "Piero Barone", "Pitbull"] } },
    select: { nameKey: true, name: true, country: true, bio: true, googleInfo: true, googleUrl: true, website: true, instagramUrl: true, facebookUrl: true, tiktokUrl: true },
  });
  for (const r of rows) console.log(`${r.name} | key=${r.nameKey} | country=${r.country ?? "-"} | bio=${r.bio ? "Y" : "N"} | panel=${r.googleInfo ? "Y" : "N"} | gurl=${r.googleUrl ?? "-"} | links=${[r.website, r.instagramUrl, r.facebookUrl, r.tiktokUrl].filter(Boolean).length}`);
  await prisma.$disconnect();
})();