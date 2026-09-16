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
const FILL: Record<string, string> = {
  lea: "Germany",
  silbermond: "Germany",
  stefanieklo: "Germany",
  brooksdunn: "United States",
};
(async () => {
  for (const [k, country] of Object.entries(FILL)) {
    const c = await prisma.celebrity.findUnique({ where: { nameKey: k }, select: { id: true, name: true, country: true } });
    if (!c) {
      console.log(`${k}: not found`);
      continue;
    }
    if (c.country) {
      console.log(`${c.name}: already ${c.country} — skip`);
      continue;
    }
    await prisma.celebrity.update({ where: { id: c.id }, data: { country } });
    console.log(`${c.name}: country -> ${country}`);
  }
  await prisma.$disconnect();
})();