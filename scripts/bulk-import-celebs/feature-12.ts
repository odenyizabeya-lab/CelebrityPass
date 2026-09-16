// Feature the requested 12 (isFeatured=true so they head the celebrity list),
// and fill empty country fields for the 3 without one from Wikidata P27 claims.
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
const UA = { "User-Agent": "CelebrityPass/1.0 (featured batch; contact admin@celebritypass.app)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NAMES = [
  "Johnny Depp", "Donald Trump", "Elon Musk", "Vladimir Putin", "Xi Jinping", "Mark Zuckerberg",
  "Tom Cruise", "Leonardo DiCaprio", "Brad Pitt", "Dwayne Johnson", "Jennifer Lopez", "Sandra Bullock",
];
const key = (n: string) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

async function firstCountryClaim(title: string): Promise<string | null> {
  await sleep(120);
  const j = (await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&titles=${encodeURIComponent(title)}&ppprop=wikibase_item&format=json&redirects=1`,
    { headers: UA, signal: AbortSignal.timeout(30000) },
  ).then((r) => r.json())) as { query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> } };
  const page = Object.values(j.query?.pages ?? {})[0];
  const id = page?.pageprops?.wikibase_item;
  if (!id) return null;

  await sleep(120);
  const ent = (await fetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${id}&props=claims&format=json`,
    { headers: UA, signal: AbortSignal.timeout(30000) },
  ).then((r) => r.json())) as { entities?: Record<string, { claims?: Record<string, unknown> }> };
  const claims = ent.entities?.[id]?.claims ?? {};
  const p27 = Array.isArray(claims["P27"]) ? claims["P27"] : [];
  const countryIds: string[] = [];
  for (const c of p27) {
    const v = (c as { mainsnak?: { datavalue?: { value?: { id?: string } } } })?.mainsnak?.datavalue?.value;
    if (v?.id) countryIds.push(v.id);
  }
  if (!countryIds.length) return null;
  await sleep(120);
  const labels = (await fetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${countryIds.join("|")}&props=labels&languages=en&format=json`,
    { headers: UA, signal: AbortSignal.timeout(30000) },
  ).then((r) => r.json())) as { entities?: Record<string, { labels?: { en?: { value?: string } } }> };
  for (const cid of countryIds) {
    const label = labels.entities?.[cid]?.labels?.en?.value;
    if (label) return label; // first (primary) citizenship
  }
  return null;
}

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });
  for (const name of NAMES) {
    const c = await prisma.celebrity.findUnique({
      where: { nameKey: key(name) },
      select: { id: true, name: true, isFeatured: true, country: true, googleInfo: true },
    });
    if (!c) {
      console.log(`${name}: NOT FOUND — skipped`);
      continue;
    }
    let countryNote = "";
    if (!c.country) {
      let title: string | null = null;
      try {
        const info = JSON.parse(c.googleInfo ?? "") as { wikipediaUrl?: string | null };
        const u = info?.wikipediaUrl ?? "";
        title = u ? decodeURIComponent(u.split("/").pop() ?? "") : name;
      } catch {}
      const country = title ? await firstCountryClaim(title) : null;
      if (country) countryNote = ` country:${country}`;
      else console.log(`${c.name}: could not resolve country via Wikidata`);
      if (!DRY && country) {
        await prisma.celebrity.update({ where: { id: c.id }, data: { country } });
      }
    }
    const flagChanged = !c.isFeatured;
    if (!DRY && flagChanged) {
      await prisma.celebrity.update({ where: { id: c.id }, data: { isFeatured: true } });
    }
    console.log(`${c.name}: ${flagChanged ? "FEATURED" : "already featured"}${countryNote}`);
  }
  console.log(DRY ? "\nDRY-RUN — set BULK_DRY=0 to apply" : "\ndone.");
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});