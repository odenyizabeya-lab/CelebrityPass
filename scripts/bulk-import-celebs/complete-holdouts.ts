// Fill the ~9 panel-less holdouts: country/website/socials from their stored
// Wikipedia URL's Wikidata item; bio from the Wikipedia lead extract. Sourced
// data only. DRY unless BULK_DRY=0.
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
const DRY = process.env.BULK_DRY !== "0";
const UA = { "User-Agent": "CelebrityPass/1.0 (holdout completion; contact admin@celebritypass.app)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cleanHandle = (s: string) => s.replace(/\s+/g, "").replace(/^@/, "");

type WikiJson = { entities?: Record<string, { labels?: Record<string, { value?: string }>; claims?: Record<string, unknown> }> };

async function wikiJson(url: string): Promise<WikiJson> {
  await sleep(100);
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as WikiJson;
}
function claimStrings(claims: unknown): string[] {
  const arr = Array.isArray(claims) ? claims : [];
  const out: string[] = [];
  for (const c of arr) {
    const v = (c as { mainsnak?: { datavalue?: { value?: unknown } } })?.mainsnak?.datavalue?.value;
    if (typeof v === "string" && v) out.push(v);
  }
  return out;
}
function claimEntityIds(claims: unknown): string[] {
  const arr = Array.isArray(claims) ? claims : [];
  const out: string[] = [];
  for (const c of arr) {
    const v = (c as { mainsnak?: { datavalue?: { value?: Record<string, unknown> } } })?.mainsnak?.datavalue?.value;
    if (v && typeof v === "object" && typeof v.id === "string") out.push(v.id);
  }
  return out;
}

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });
  const keys = ["pierobarone", "johannvonblow", "brooksdunn", "giorgiomarchesi", "paolopierobon", "lea", "stefaniekloss", "silbermond", "tabu"];
  let updated = 0, unresolved = 0;
  for (const k of keys) {
    const c = await prisma.celebrity.findUnique({
      where: { nameKey: k },
      select: { id: true, name: true, country: true, bio: true, website: true, instagramUrl: true, facebookUrl: true, tiktokUrl: true, googleUrl: true },
    });
    if (!c) {
      console.log(`${k}: not found`);
      continue;
    }
    const patch: Record<string, unknown> = {};
    const title = c.googleUrl ? decodeURIComponent(c.googleUrl.split("/").pop() ?? "") : null;
    if (!title) {
      unresolved++;
      console.log(`${c.name}: no wikipedia url — skipped`);
      continue;
    }
    try {
      // Wikipedia lead extract -> bio (sourced).
      if (!c.bio) {
        await sleep(100);
        const ex = (await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=1&redirects=1&titles=${encodeURIComponent(title)}&format=json`,
          { headers: UA, signal: AbortSignal.timeout(30000) },
        ).then((r) => r.json())) as { query?: { pages?: Record<string, { extract?: string }> } };
        const page = Object.values(ex.query?.pages ?? {})[0];
        if (page?.extract) {
          const t = page.extract.replace(/\s+/g, " ").trim();
          patch.bio = t.length > 1100 ? t.slice(0, t.lastIndexOf(" ", 1100)) + "…" : t;
        }
      }
      // Wikidata item for country + claims.
      const needClaims = !c.country || !c.website || !c.instagramUrl || !c.facebookUrl || !c.tiktokUrl;
      if (needClaims) {
        await sleep(100);
        const pp = (await wikiJson(
          `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&titles=${encodeURIComponent(title)}&ppprop=wikibase_item&format=json&redirects=1`,
        )) as unknown as { query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> } };
        const wikidataId = Object.values(pp.query?.pages ?? {})[0]?.pageprops?.wikibase_item;
        if (wikidataId) {
          const ent = await wikiJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=claims&format=json`);
          const claims = ent.entities?.[wikidataId]?.claims ?? {};
          if (!c.country) {
            const countryIds = claimEntityIds(claims["P27"]);
            if (countryIds.length) {
              const labels = await wikiJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${countryIds.join("|")}&props=labels&languages=en&format=json`);
              for (const id of countryIds) {
                const label = labels.entities?.[id]?.labels?.en?.value;
                if (label) {
                  patch.country = label;
                  break;
                }
              }
            }
          }
          if (!c.website) {
            const sites = claimStrings(claims["P856"]).filter((u) => /^https?:\/\//i.test(u));
            if (sites.length) patch.website = sites[0];
          }
          if (!c.instagramUrl) {
            const h = cleanHandle(claimStrings(claims["P2003"])[0] ?? "");
            if (h) patch.instagramUrl = `https://instagram.com/${h}`;
          }
          if (!c.facebookUrl) {
            const h = cleanHandle(claimStrings(claims["P2013"])[0] ?? "");
            if (h) patch.facebookUrl = `https://facebook.com/${h}`;
          }
          if (!c.tiktokUrl) {
            const h = cleanHandle(claimStrings(claims["P7085"])[0] ?? "");
            if (h) patch.tiktokUrl = `https://tiktok.com/@${h}`;
          }
        }
      }
    } catch (e) {
      console.log(`  ${c.name}: lookup failed (${(e as Error).message})`);
      unresolved++;
      continue;
    }
    if (Object.keys(patch).length === 0) {
      unresolved++;
      console.log(`${c.name}: nothing fillable`);
      continue;
    }
    console.log(`${c.name}: ${Object.keys(patch).join(",")}`);
    updated++;
    if (!DRY) await prisma.celebrity.update({ where: { id: c.id }, data: patch });
  }
  console.log(`\n${DRY ? "DRY-RUN — would update" : "updated"}: ${updated} | unresolved: ${unresolved}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});