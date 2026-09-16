// Health-check every celebrity page on the LIVE site: GET /celebrity/<slug>,
// verify HTTP 200 + page actually renders a profile (not the 404 shell).
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
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://celebritypass.app";
const prisma = new PrismaClient({ log: ["error"] });
const CONCURRENCY = 12;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Res = { name: string; slug: string; status: number; alive: boolean };

async function checkOne(c: { name: string; slug: string }): Promise<Res> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(`${BASE}/celebrity/${c.slug}`, { signal: ctrl.signal, headers: { "User-Agent": "CelebrityPass-health/1.0" } });
    clearTimeout(t);
    let alive = res.status === 200;
    if (alive) {
      // read a small slice to confirm it isn't the 404 shell
      const buf = (await res.arrayBuffer()).slice(0, 65536);
      const head = Buffer.from(buf).toString("utf8");
      if (/Not Found \| CelebrityPass/.test(head)) alive = false;
    }
    return { name: c.name, slug: c.slug, status: res.status, alive };
  } catch (e) {
    return { name: c.name, slug: c.slug, status: 0, alive: false };
  }
}

async function main() {
  const limit = process.env.HEALTH_LIMIT ? Number(process.env.HEALTH_LIMIT) : null;
  const all = await prisma.celebrity.findMany({
    select: { name: true, slug: true, country: true, bio: true, googleInfo: true },
    orderBy: { nameKey: "asc" },
  });
  console.log(`total celebs in DB: ${all.length}`);
  const targets = limit ? all.slice(0, limit) : all;
  const results: Res[] = [];
  let idx = 0;
  async function worker() {
    while (idx < targets.length) {
      const c = targets[idx++];
      results.push(await checkOne(c));
      await sleep(60);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const alive = results.filter((r) => r.alive);
  const dead = results.filter((r) => !r.alive);
  console.log(`checked: ${results.length} | ALIVE: ${alive.length} | DEAD: ${dead.length}`);
  for (const d of dead) console.log(`  DEAD ${d.status}  /celebrity/${d.slug}  (${d.name})`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});