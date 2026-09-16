// READ-ONLY sample: how are profileImageHash/license/status populated today?
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
    select: { slug: true, profileImageHash: true, imageStatus: true, imageLicense: true, imageVerified: true, imageSource: true, imageSourceUrl: true, imageAttribution: true, imageMediaUrl: true },
    orderBy: { slug: "asc" },
    take: 12,
  });
  for (const r of rows) console.log(r.slug, "| hash=", r.profileImageHash, "| status=", r.imageStatus, "| lic=", r.imageLicense, "| verified=", r.imageVerified, "| src=", r.imageSource, "| mediaUrl=", r.imageMediaUrl);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exitCode = 1; });