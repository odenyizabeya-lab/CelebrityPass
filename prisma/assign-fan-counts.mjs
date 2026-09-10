// Assign every celebrity a unique auto-assigned "Registered Fans" figure
// (9,272–5,000,000), judged from Google-style knowledge-panel data (the same
// Wikipedia/Wikidata public sources that power Google's panel in google-info.ts):
// celebrities with a substantial public profile get a big figure (1M–5M);
// unknown/minor names stay small (9,272–999,999). Idempotent: skips
// celebrities that already have a figure, and never reuses a figure.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Minimal .env loader so this works when run directly with node (Prisma's CLI
// does this automatically, plain node does not).
try {
  const dotenv = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of dotenv.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
} catch {
  // No .env file — rely on already-set environment variables.
}

const prisma = new PrismaClient();

const FANS_MIN = 9272;
const FANS_LOW_MAX = 999999;
const FANS_BIG_MIN = 1000000;
const FANS_CEILING = 5000000;
const BIG_THRESHOLD = 14;

const UA = "CelebrityPass/1.0 (celebrity profile enrichment; contact@celebritypass.app)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.ok && res.status < 300) return await res.json();
      last = new Error("HTTP " + res.status);
      if (res.status === 429 || res.status >= 500) {
        await sleep(1200 * (i + 1));
        continue;
      }
      throw last;
    } catch (e) {
      last = e;
      await sleep(600 * (i + 1));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

// Minimal Google-panel shape fetched live: name, description, overview + a
// human-entity check so non-people (bands, letters) are rejected, mirroring
// google-info.ts. Returns null when no real person profile is found.
async function lookupPanel(name, profession = "", category = "") {
  try {
    const q = encodeURIComponent(name);
    const res = await fetchJson(
      `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&titles=${q}&format=json&ppprop=wikibase_item&redirects=1`
    );
    const page = Object.values(res?.query?.pages || {})[0];
    if (!page?.title) return null;
    const wikidataId = page.pageprops?.wikibase_item || null;
    const sum = await fetchJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`
    ).catch(() => null);
    if (!sum || sum.type === "disambiguation") return null;
    if (sum.detail && !sum.extract) return null;
    let siteLinks = null;
    if (wikidataId) {
      try {
        const ent = await fetchJson(
          `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=claims|sitelinks&format=json`
        );
        const e = ent?.entities?.[wikidataId] || {};
        const claims = e.claims || {};
        const list = (a) => (Array.isArray(a) ? a : []);
        const isHuman =
          list(claims.P31).some((c) => c?.mainsnak?.datavalue?.value?.id === "Q5") ||
          list(claims.P106).length > 0;
        if (!isHuman) return null;
        siteLinks = typeof e.sitelinks === "object" && e.sitelinks ? Object.keys(e.sitelinks).length : null;
      } catch {
        /* keep the summary-based guess */
      }
    }
    return {
      name,
      description: sum.description || null,
      born: null,
      age: null,
      occupations: [],
      films: [],
      overview: sum.extract || null,
      siteLinks,
      wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
      source: "wikipedia/wikidata",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function fameScore(info, social) {
  if (!info) return 0;
  let s = 0;
  const ov = (info.overview || "").trim();
  if (ov) s += 4 + Math.min(40, ov.length / 50);
  const d = (info.description || "").trim();
  if (d) s += Math.min(6, d.length / 10);
  s += Math.min(8, (info.occupations || []).length * 2);
  s += Math.min(20, (info.films || []).length * 2);
  if (info.born) s += 4;
  s += Math.min(30, (info.siteLinks || 0) / 3);
  s += Math.min(10, (social / 5e6) * 2);
  return s;
}

function seededInt(seed, bound) {
  if (bound <= 0) return 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % bound;
}

function candidateNumber(slug, big) {
  const lo = big ? FANS_BIG_MIN : FANS_MIN;
  const hi = big ? FANS_CEILING : FANS_LOW_MAX;
  return lo + seededInt(`${slug}:registered-fans`, hi - lo + 1);
}

async function main() {
  const rows = await prisma.celebrity.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      profession: true,
      category: true,
      googleInfo: true,
      displayFanCount: true,
      instagramFollowers: true,
      tiktokFollowers: true,
      facebookFollowers: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const missing = rows.filter((r) => r.displayFanCount == null);
  console.log(`celebrities: ${rows.length}, missing figure: ${missing.length}`);

  const taken = new Set(rows.map((r) => r.displayFanCount).filter((n) => n != null));

  for (const row of rows) {
    let info = null;
    try {
      info = row.googleInfo ? JSON.parse(row.googleInfo) : null;
    } catch {
      info = null;
    }
    // Refetch when we have no usable panel yet (also refreshes panels that were
    // saved before the siteLinks signal existed).
    if (!info?.overview || info.siteLinks == null) {
      process.stdout.write(`  fetching panel for ${row.name} ... `);
      info = await lookupPanel(row.name, row.profession, row.category);
      console.log(info ? "ok" : "none");
      if (info) {
        try {
          await prisma.celebrity.update({ where: { id: row.id }, data: { googleInfo: JSON.stringify(info) } });
        } catch {
          /* non-fatal */
        }
      }
    }
    const social = Math.max(
      row.instagramFollowers || 0,
      row.tiktokFollowers || 0,
      row.facebookFollowers || 0
    );
    const big = fameScore(info, social) >= BIG_THRESHOLD;
    // Needs a number: missing figure, or a famous celebrity currently stuck on a
    // small figure (upgrades only — never demote below an already-assigned one).
    const needs =
      row.displayFanCount == null || (big && (row.displayFanCount ?? 0) < FANS_BIG_MIN);
    if (!needs) {
      console.log(`  ${row.name} -> ${big ? "big" : "low"} ${(row.displayFanCount ?? 0).toLocaleString("en-US")} (kept)`);
      continue;
    }
    const lo = big ? FANS_BIG_MIN : FANS_MIN;
    const hi = big ? FANS_CEILING : FANS_LOW_MAX;
    let n = candidateNumber(row.slug, big);
    let guard = 0;
    while (taken.has(n) && guard++ < 10000) {
      n += 41;
      if (n > hi) n = lo + ((n - lo) % (hi - lo + 1));
    }
    taken.add(n);
    await prisma.celebrity.update({ where: { id: row.id }, data: { displayFanCount: n } });
    console.log(`  ${row.name} -> ${big ? "big" : "low"} ${n.toLocaleString("en-US")} (assigned)`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});