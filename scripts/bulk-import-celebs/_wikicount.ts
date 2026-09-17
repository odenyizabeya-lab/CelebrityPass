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
if (/pooler\.supabase\.com/i.test(process.env.DATABASE_URL ?? "") && process.env.DIRECT_DATABASE_URL) process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL;
const prisma = new PrismaClient({ log: ["error"] });
const db = async <T>(fn: () => Promise<T>): Promise<T> => {
  for (let i = 0; i < 5; i++) {
    try { return await fn(); }
    catch (e) { if (i === 4) throw e; await new Promise((r) => setTimeout(r, 2000 * (i + 1))); }
  }
  throw new Error("unreachable");
};
(async () => {
  const total = await db(() => prisma.celebrity.count());
  const withWiki = await db(() => prisma.celebrity.count({ where: { NOT: { googleInfo: null } } }));
  let haveUrl = 0;
  const rows = await db(() => prisma.celebrity.findMany({ select: { slug: true, googleInfo: true } }));
  for (const r of rows) {
    try {
      const j = JSON.parse(r.googleInfo ?? "");
      if (j?.wikipediaUrl) haveUrl++;
    } catch {}
  }
  console.log(`total=${total} | googleInfo-not-null=${withWiki} | wikipediaUrl-PRESENT=${haveUrl}`);
  console.log(`clickable-photos=${haveUrl} | not-clickable-yet=${total - haveUrl}`);
  const sample = rows.filter((r) => { try { return !!JSON.parse(r.googleInfo ?? "")?.wikipediaUrl; } catch { return false; } }).slice(0, 8);
  console.log("sample clickable:", sample.map((s) => s.slug).join(", "));
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exitCode = 1; });