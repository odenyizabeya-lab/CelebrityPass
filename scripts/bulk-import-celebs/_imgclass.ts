// READ-ONLY: classify stored profile/cover images 100% inside Postgres.
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
    catch (e) { if (i === 4) throw e; await new Promise((r) => setTimeout(r, 2500 * (i + 1))); }
  }
  throw new Error("unreachable");
};

(async () => {
  const runs = await db(() => prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE("profileImage",'') = '')::int AS p_empty,
      COUNT(*) FILTER (WHERE COALESCE("profileImage",'') LIKE 'data:image/svg+xml%')::int AS p_svg,
      COUNT(*) FILTER (WHERE COALESCE("profileImage",'') LIKE 'data:image/%')::int AS p_data,
      COUNT(*) FILTER (WHERE COALESCE("profileImage",'') ~ '^https?:')::int AS p_http,
      COUNT(*) FILTER (WHERE "profileImage" IS NULL)::int AS p_null,
      COUNT(*) FILTER (WHERE LENGTH(COALESCE("profileImage",'')) < 3000 AND COALESCE("profileImage",'') NOT LIKE 'data:image/svg+xml%' AND COALESCE("profileImage",'') <> '')::int AS p_tiny,
      COUNT(*) FILTER (WHERE COALESCE("coverImage",'') <> '')::int AS c_nonempty,
      COUNT(*) FILTER (WHERE COALESCE("coverImage",'') LIKE 'data:image/svg+xml%')::int AS c_svg,
      COUNT(*) FILTER (WHERE COALESCE("coverImage",'') ~ '^https?:')::int AS c_http
    FROM "Celebrity";
  `));
  console.log("PROFILE:", JSON.stringify(runs[0]));

  const svgs = await db(() => prisma.$queryRawUnsafe<any[]>(`
    SELECT slug, name, LENGTH("profileImage") AS len FROM "Celebrity"
    WHERE COALESCE("profileImage",'') LIKE 'data:image/svg+xml%'
    ORDER BY slug;`));
  console.log(`\nSVG placeholder profiles (${svgs.length}): `);
  svgs.slice(0, 40).forEach((s) => console.log(`  ${s.slug} | ${s.name} | ${s.len}B`));
  if (svgs.length > 40) console.log(`  ... +${svgs.length - 40}`);

  const empty = await db(() => prisma.$queryRawUnsafe<any[]>(`
    SELECT slug, name FROM "Celebrity" WHERE COALESCE("profileImage",'') = '' ORDER BY slug;`));
  console.log(`\nEMPTY profile images (${empty.length}): ${empty.map((e) => e.slug).join(", ") || "(none)"}`);

  const tiny = await db(() => prisma.$queryRawUnsafe<any[]>(`
    SELECT slug, name, LENGTH("profileImage") AS len FROM "Celebrity"
    WHERE LENGTH(COALESCE("profileImage",'')) < 3000
      AND COALESCE("profileImage",'') <> ''
      AND COALESCE("profileImage",'') NOT LIKE 'data:image/svg+xml%'
    ORDER BY len;`));
  console.log(`\nTINY/non-svg (<3KB) profiles (${tiny.length}): `);
  tiny.slice(0, 30).forEach((s) => console.log(`  ${s.slug} | ${s.name} | ${s.len}B`));

  const http = await db(() => prisma.$queryRawUnsafe<any[]>(`
    SELECT slug, name, LEFT("profileImage", 80) AS head FROM "Celebrity"
    WHERE COALESCE("profileImage",'') ~ '^https?:' ORDER BY slug;`));
  console.log(`\nHTTP image URLs stored (${http.length}): `);
  http.slice(0, 30).forEach((s) => console.log(`  ${s.slug} | ${s.head}`));

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exitCode = 1; });