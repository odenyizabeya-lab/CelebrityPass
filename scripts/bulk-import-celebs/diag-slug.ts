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
  for (const key of ["danielbruhl", "pierobarone", "marioncotillard", "taylorswift"]) {
    const c = await prisma.celebrity.findUnique({
      where: { nameKey: key },
      select: { name: true, nameKey: true, slug: true, isActive: true },
    });
    console.log(c ? `${c.name} | key=${c.nameKey} | slug=${c.slug} | active=${c.isActive}` : `${key} not found`);
  }
  const dupes = await prisma.celebrity.findMany({ where: { OR: [{ slug: "daniel-bruhl" }, { slug: "daniel-brühl" }] }, select: { name: true, slug: true, isActive: true } });
  console.log("by slug:", JSON.stringify(dupes));
  await prisma.$disconnect();
})();