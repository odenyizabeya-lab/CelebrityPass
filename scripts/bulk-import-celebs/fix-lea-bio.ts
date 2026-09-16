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
const UA = { "User-Agent": "CelebrityPass/1.0 (admin fix)" };
(async () => {
  const res = await fetch("https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=1&redirects=1&titles=Lea%20(musician)&format=json", { headers: UA });
  const j = (await res.json()) as { query?: { pages?: Record<string, { extract?: string }> } };
  const page = Object.values(j.query?.pages ?? {})[0];
  if (!page?.extract) {
    console.log("no extract");
    await prisma.$disconnect();
    return;
  }
  const bio = page.extract.replace(/\s+/g, " ").trim();
  const c = await prisma.celebrity.findUnique({ where: { nameKey: "lea" }, select: { id: true, name: true } });
  if (!c) {
    console.log("LEA not found");
    await prisma.$disconnect();
    return;
  }
  await prisma.celebrity.update({ where: { id: c.id }, data: { bio } });
  console.log(`${c.name}: bio updated (${bio.length} chars): ${bio.slice(0, 110)}…`);
  await prisma.$disconnect();
})();