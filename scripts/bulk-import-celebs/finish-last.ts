// Last-pass completion for the ~10 holdouts (incl. Pitbull's missing country):
// resolve their real Wikipedia article via search, fill bio (lead extract) and
// country/socials (Wikidata claims). Sourced data only. DRY unless BULK_DRY=0.
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

type J = { entities?: Record<string, { labels?: Record<string, { value?: string }>; claims?: Record<string, unknown> }> };
async function j(url: string): Promise<J> {
  await sleep(100);
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as J;
}
function strings(c: unknown): string[] {
  const a = Array.isArray(c) ? c : [];
  return a.map((x) => (x as { mainsnak?: { datavalue?: { value?: unknown } } })?.mainsnak?.datavalue?.value).filter((v): v is string => typeof v === "string" && !!v);
}
function ids(c: unknown): string[] {
  const a = Array.isArray(c) ? c : [];
  return a.map((x) => (x as { mainsnak?: { datavalue?: { value?: { id?: string } } } })?.mainsnak?.datavalue?.value?.id).filter((v): v is string => !!v);
}

const TARGETS: Array<{ nameKey: string; exact?: string; hint: string; countryOverride?: string; wiki?: string; skip?: boolean }> = [
  { nameKey: "pierobarone", exact: "Piero Barone", hint: "Piero Barone" },
  { nameKey: "brooksdunn", exact: "Brooks & Dunn", hint: "Brooks & Dunn" },
  { nameKey: "johannvonbulow", exact: "", hint: "Johann von Bülow Schauspieler", skip: true },
  { nameKey: "tabu", exact: "", hint: "Tabu band", skip: true },
  { nameKey: "lea", exact: "Lea (singer)", hint: "Lea (singer)" },
  { nameKey: "giorgiomarchesi", exact: "Giorgio Marchesi", hint: "Giorgio Marchesi actor", wiki: "it" },
  { nameKey: "paolopierobon", exact: "Paolo Pierobon", hint: "Paolo Pierobon actor", wiki: "it" },
  { nameKey: "silbermond", exact: "Silbermond", hint: "Silbermond" },
  { nameKey: "stefanieklo", exact: "Stefanie Kloß", hint: "Stefanie Kloß" },
  { nameKey: "pitbull", exact: "Pitbull (rapper)", hint: "Pitbull rapper", countryOverride: "United States" },
];

async function resolveTitle(exact: string | undefined, hint: string, wikiLang = "en"): Promise<string | null> {
  if (exact) {
    const u = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&prop=extracts|pageprops&exintro=1&redirects=1&ppprop=wikibase_item|disambiguation&titles=${encodeURIComponent(exact)}&format=json`;
    const r = (await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }).then((x) => x.json())) as { query?: { pages?: Record<string, { missing?: string; extract?: string; pageprops?: { disambiguation?: string; wikibase_item?: string } }> } };
    const page = Object.values(r.query?.pages ?? {})[0];
    if (page && !page.missing && !page.pageprops?.disambiguation && page.pageprops?.wikibase_item && !/^(.+ )?may refer to:?$/.test((page.extract ?? "").trim().replace(/\s+/g, " "))) {
      return exact;
    }
    if (page?.pageprops?.disambiguation) console.log(`  (exact '${exact}' is a disambiguation page -> search)`);
  }
  const u = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(hint)}&srlimit=10&format=json&redirects=1`;
  const r = (await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }).then((x) => x.json())) as { query?: { search?: Array<{ title: string }> } };
  const rows = r.query?.search ?? [];
  if (!rows.length) return null;
  const rank = (t: string) => (/(rapper|\(singer\)|\(actor\)|\(band\)|\(musician\)|musician|band)/i.test(t) ? 0 : /^[A-Za-z0-9&.' -]+$/.test(t) ? 1 : 2);
  const best = [...rows].sort((a, b) => rank(a.title) - rank(b.title) || rows.indexOf(a) - rows.indexOf(b))[0];
  return best.title;
}

async function fillOne(title: string, wikiLang = "en") {
  const out: Record<string, unknown> = {};
  const notes: string[] = [];
  await sleep(100);
  const ex = (await fetch(
    `https://${wikiLang}.wikipedia.org/w/api.php?action=query&prop=extracts|pageprops&explaintext=1&exintro=1&redirects=1&ppprop=wikibase_item&titles=${encodeURIComponent(title)}&format=json`,
    { headers: UA, signal: AbortSignal.timeout(30000) },
  ).then((x) => x.json())) as { query?: { pages?: Record<string, { extract?: string; pageprops?: { wikibase_item?: string } }> } };
  const page = Object.values(ex.query?.pages ?? {})[0];
  if (!page) {
    notes.push("no page");
    return { out, notes };
  }
  if (page.extract && wikiLang === "en") {
    const t = page.extract.replace(/\s+/g, " ").trim();
    out.bio = t.length > 1100 ? t.slice(0, t.lastIndexOf(" ", 1100)) + "…" : t;
    notes.push("bio");
  }
  const wid = page.pageprops?.wikibase_item;
  if (wid) {
    const ent = await j(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wid}&props=claims&format=json`);
    const claims = ent.entities?.[wid]?.claims ?? {};
    const cIds = ids(claims["P27"]);
    if (cIds.length) {
      const labels = await j(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${cIds.join("|")}&props=labels&languages=en&format=json`);
      for (const id of cIds) {
        const label = labels.entities?.[id]?.labels?.en?.value;
        if (label) {
          out.country = label;
          notes.push(`country:${label}`);
          break;
        }
      }
    }
    const sites = strings(claims["P856"]).filter((s) => /^https?:\/\//i.test(s));
    if (sites.length) {
      out.website = sites[0];
      notes.push("website");
    }
    const ig = cleanHandle(strings(claims["P2003"])[0] ?? "");
    if (ig) out.instagramUrl = `https://instagram.com/${ig}`;
    const fb = cleanHandle(strings(claims["P2013"])[0] ?? "");
    if (fb) out.facebookUrl = `https://facebook.com/${fb}`;
    const tt = cleanHandle(strings(claims["P7085"])[0] ?? "");
    if (tt) out.tiktokUrl = `https://tiktok.com/@${tt}`;
    if (ig || fb || tt) notes.push("socials");
  }
  return { out, notes };
}

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });
  let updated = 0, fails = 0;
  for (const t of TARGETS) {
    const c = await prisma.celebrity.findUnique({
      where: { nameKey: t.nameKey },
      select: { id: true, name: true, country: true, bio: true, website: true, instagramUrl: true, facebookUrl: true, tiktokUrl: true },
    });
    if (!c) {
      console.log(`${t.nameKey}: NOT FOUND in DB`);
      continue;
    }
    if (t.skip) {
      console.log(`${c.name}: skipped (no reliable source available)`);
      fails++;
      continue;
    }
    const title = await resolveTitle(t.exact, t.hint, t.wiki ?? "en");
    if (!title) {
      fails++;
      console.log(`${c.name}: no wiki article found`);
      continue;
    }
    let patch: Record<string, unknown> = {};
    let notes: string[] = [];
    try {
      const r = await fillOne(title, t.wiki ?? "en");
      patch = r.out;
      notes = r.notes;
    } catch (e) {
      fails++;
      console.log(`${c.name}: lookup failed (${(e as Error).message})`);
      continue;
    }
    if (t.countryOverride && !c.country) patch.country = t.countryOverride;
    // only keep fill-empty fields
    for (const k of Object.keys(patch)) {
      if ((c as Record<string, unknown>)[k]) delete patch[k];
    }
    if (Object.keys(patch).length === 0) {
      fails++;
      console.log(`${c.name}: nothing left to fill (${notes.join(",")})`);
      continue;
    }
    console.log(`${c.name}: (${title}) -> ${Object.keys(patch).join(",")} [${notes.join(",")}]`);
    updated++;
    if (!DRY) await prisma.celebrity.update({ where: { id: c.id }, data: patch });
  }
  console.log(`\n${DRY ? "DRY-RUN — would update" : "updated"}: ${updated} | failed: ${fails}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});