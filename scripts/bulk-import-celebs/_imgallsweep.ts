// READ-ONLY: verify every profile image route returns a real image, with
// bounded concurrency + retries so transient throttling isn't reported as broken.
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

const BASE = "https://celebritypass.app";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const CONCURRENCY = 6;
const TIMEOUT_MS = 45000;
const RETRIES = 3;

async function check(route: string): Promise<{ ok: boolean; detail: string }> {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    let r: Response;
    try {
      r = await fetch(route, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const okStatus = r.status === 200;
      const ctype = r.headers.get("content-type") ?? "";
      const isImage = ctype.startsWith("image/");
      await r.body?.cancel();
      if (okStatus && isImage) return { ok: true, detail: ctype };
      if (!okStatus) return { ok: false, detail: `HTTP ${r.status}` };
      return { ok: false, detail: `content-type ${ctype}` };
    } catch (e) {
      const msg = `${(e as Error).name}:${(e as Error).message.slice(0, 60)}`;
      if (attempt === RETRIES) return { ok: false, detail: msg };
      await new Promise((res) => setTimeout(res, 1200 * attempt));
    }
  }
  return { ok: false, detail: "unreachable" };
}

(async () => {
  const slugs = (await prisma.celebrity.findMany({ select: { slug: true } })).map((r) => r.slug);
  const jobs = slugs.map((slug) => `${BASE}/images/${slug}/profile`);
  const bad: { slug: string; detail: string }[] = [];
  let done = 0;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(check));
    results.forEach((res, idx) => {
      const slug = slugs[i + idx];
      if (res.status === "fulfilled" && res.value.ok) done++;
      else bad.push({ slug, detail: res.status === "fulfilled" ? res.value.detail : "unknown" });
    });
    if (done % 120 === 0 && done < 1100) console.log(`  ...${done}/${slugs.length} OK`);
  }
  console.log(`RESULT: ${done}/${slugs.length} image routes OK; BROKEN=${bad.length}`);
  bad.forEach((b) => console.log(`  ${b.slug}: ${b.detail}`));
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exitCode = 1; });