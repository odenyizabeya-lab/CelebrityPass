// Complete the original batch: fill BIO from the stored knowledge panel overview,
// and COUNTRY + official WEBSITE/socials from WIKIDATA CLAIMS ONLY (never
// guessed). Fetches a knowledge panel for the few originals still missing one.
// Fill-empty-only; idempotent; DRY unless BULK_DRY=0.
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";

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
// Keep a small pool with generous timeouts — the Supabase endpoint is flaky from
// this network and Prisma's default pool can strand sockets mid-run.
const DB_URL = new URL(process.env.DATABASE_URL!);
const dbArgs = DB_URL.searchParams;
dbArgs.set("connection_limit", "4");
dbArgs.set("pool_timeout", "30000");
dbArgs.set("connect_timeout", "20");
process.env.DATABASE_URL = DB_URL.toString();
const DRY = process.env.BULK_DRY !== "0";
const MAX = Number(process.env.BULK_MAX_NEW) > 0 ? Number(process.env.BULK_MAX_NEW) : Infinity;
const UA = { "User-Agent": "CelebrityPass/1.0 (profile completion; contact admin@celebritypass.app)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run a DB op with retries + backoff; transient Supabase pool errors are common here. */
async function db<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= 4; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const wait = 2000 * i + Math.random() * 1000;
      console.log(`  [db-retry ${i}] ${label} failed — waiting ${Math.round(wait)}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

const LATER = new Set<string>([
  "donaldtrump","elonmusk","emmanuelmacron","luizinacioluladasilva","javiermilei","claudiasheinbaum","xijinping","vladimirputin","leejamyung","receptayyiperdoan","volodymyrzelenskyy","jeffbezos","billgates","markzuckerberg","larrypage","sergeybrin","larryellison","michaeldell","jensenhuang","warrenbuffett","richardbranson","jackma","mukeshambani","gautamadani","carlosslim","bernardarnault","amancioortega","masayoshison","michaelbloomberg","georgesoros","peterthiel","reedhastings","jackdorsey","brianchesky","philknight","stevewozniak","michaelrubin","raydalio","richardliu","tadashiyanai",
  "shahrukhkhan","robertpattinson","willferrell","jimcarrey","hughgrant","emmawatson","zendaya","ryanreynolds","ryangosling","rihanna","ladygaga","adele","celinedion","justinbieber","theweeknd","drake","shakira","katyperry","pink","edsheeran","britneyspears","christinaaguilera","mileycyrus",
]);

// Primary nationalities where Wikidata P27 claim order is misleading.
const COUNTRY_OVERRIDES: Record<string, string> = {
  "Javier Milei": "Argentina",
  "Volodymyr Zelenskyy": "Ukraine",
  "Steve Wozniak": "United States",
  "Carlos Slim": "Mexico",
  "George Soros": "United States",
  "Shakira": "Colombia",
  "Jim Carrey": "Canada",
};

// Wikidata FB claims pointing at a different entity.
const FB_HANDLE_DROP: Record<string, boolean> = { "Peter Thiel": true };

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
    if (v && typeof v === "object" && typeof (v as Record<string, unknown>).id === "string") {
      out.push((v as Record<string, unknown>).id as string);
    }
  }
  return out;
}

type Row = {
  id: string; name: string; nameKey: string; category: string; profession: string | null;
  country: string | null; bio: string | null; googleInfo: string | null;
  website: string | null; instagramUrl: string | null; facebookUrl: string | null; tiktokUrl: string | null; googleUrl: string | null;
};

type Patch = { bio?: string; country?: string; website?: string; instagramUrl?: string; facebookUrl?: string; tiktokUrl?: string; googleInfo?: string };

async function enrichOne(c: Row, info: { wikipediaUrl?: string | null; overview?: string | null; description?: string | null }): Promise<{ patch: Patch; notes: string[] }> {
  const notes: string[] = [];
  const patch: Patch = {};
  const wikipediaUrl = info?.wikipediaUrl ?? null;

  // BIO from panel overview (no extra API calls).
  if (!c.bio && info?.overview) {
    const t = info.overview.replace(/\s+/g, " ").trim();
    patch.bio = t.length > 1100 ? t.slice(0, t.lastIndexOf(" ", 1100)) + "â€¦" : t;
  }

  const needsClaims = !c.country || !c.website || !c.instagramUrl || !c.facebookUrl || !c.tiktokUrl;
  if (needsClaims) {
    let wikidataId: string | null = null;
    try {
      const title = wikipediaUrl ? decodeURIComponent(wikipediaUrl.split("/").pop() ?? "") : c.name;
      const j = (await wikiJson(
        `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&titles=${encodeURIComponent(title)}&ppprop=wikibase_item&format=json&redirects=1`,
      )) as unknown as { query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> } };
      const page = Object.values(j.query?.pages ?? {})[0];
      wikidataId = page?.pageprops?.wikibase_item ?? null;
    } catch {
      notes.push("wikidata resolve failed");
    }

    if (wikidataId) {
      try {
        const ent = await wikiJson(
          `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=claims&format=json`,
        );
        const e = ent.entities?.[wikidataId];
        const claims = e?.claims ?? {};
        const countries = claimEntityIds(claims["P27"]);
        if (!c.country && countries.length > 0) {
          try {
            const labels = await wikiJson(
              `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${countries.join("|")}&props=labels&languages=en&format=json`,
            );
            const seen = countries.map((id) => labels.entities?.[id]?.labels?.en?.value ?? "").filter(Boolean);
            if (seen.length > 0) {
              const target = COUNTRY_OVERRIDES[c.name] ?? seen[0];
              patch.country = target;
              notes.push(`country:${seen[0]}${COUNTRY_OVERRIDES[c.name] ? "(override)" : ""}`);
            }
          } catch {
            notes.push("country labels failed");
          }
        }
        if (!c.website) {
          const sites = claimStrings(claims["P856"]).filter((u) => /^https?:\/\//i.test(u));
          if (sites.length > 0) patch.website = sites[0];
        }
        if (!c.instagramUrl) {
          const h = cleanHandle(claimStrings(claims["P2003"])[0] ?? "");
          if (h) patch.instagramUrl = `https://instagram.com/${h}`;
        }
        if (!c.facebookUrl && !FB_HANDLE_DROP[c.name]) {
          const h = cleanHandle(claimStrings(claims["P2013"])[0] ?? "");
          if (h) patch.facebookUrl = `https://facebook.com/${h}`;
        }
        if (!c.tiktokUrl) {
          const h = cleanHandle(claimStrings(claims["P7085"])[0] ?? "");
          if (h) patch.tiktokUrl = `https://tiktok.com/@${h}`;
        }
      } catch {
        notes.push("wikidata claims failed");
      }
    }
  }

  if (!c.googleUrl && wikipediaUrl) patch.googleUrl = wikipediaUrl;
  return { patch, notes };
}

async function main() {
  const { fetchGoogleInfo } = await import("../../src/lib/google-info.ts");
  const prisma = new PrismaClient({ log: ["error"] });

  const rows = await db("fetch all", () => prisma.celebrity.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, nameKey: true, category: true, profession: true, country: true, bio: true, googleInfo: true, website: true, instagramUrl: true, facebookUrl: true, tiktokUrl: true, googleUrl: true },
  }) as Row[]);
  const targets = rows.filter((c) => !LATER.has(c.nameKey));

  const report: string[] = [];
  let updated = 0, skipped = 0, failed = 0, done = 0;
  console.log(`originals to process: ${targets.length} (dry=${DRY})`);

  for (const c of targets) {
    if (done >= MAX) break;
    done++;
    const anyLink = !!(c.googleUrl || c.website || c.instagramUrl || c.facebookUrl || c.tiktokUrl);
    if (c.googleInfo && c.country && c.bio && anyLink) {
      skipped++;
      continue;
    }

    const patch: Patch = {};
    const notes: string[] = [];
    let info: { wikipediaUrl?: string | null; overview?: string | null; description?: string | null } | null = null;

    if (!c.googleInfo) {
      try {
        const fetched = await fetchGoogleInfo(c.name, { force: true, profession: c.profession ?? c.category, category: c.category });
        if (fetched) {
          patch.googleInfo = JSON.stringify(fetched);
          info = fetched as { wikipediaUrl?: string | null; overview?: string | null; description?: string | null };
          notes.push("panel-fetched");
        }
      } catch {
        notes.push("panel-fetch-failed");
      }
    } else {
      try {
        info = JSON.parse(c.googleInfo) as { wikipediaUrl?: string | null; overview?: string | null; description?: string | null };
      } catch {
        notes.push("unparseable-panel");
      }
    }

    if (info) {
      const r = await enrichOne(c, info);
      Object.assign(patch, r.patch);
      notes.push(...r.notes);
    }

    if (Object.keys(patch).length > 0) {
      report.push(`${c.name}: ${Object.keys(patch).join(",")} [${notes.join(";")}]`);
      if (!DRY) {
        await db("update " + c.name, () => prisma.celebrity.update({ where: { id: c.id }, data: patch }));
        updated++;
      }
    } else {
      failed++; // couldn't fill anything
      report.push(`${c.name}: no fields filled [${notes.join(";")}]`);
    }
    if (done % 20 === 0) console.log(`  progress ${done}/${targets.length}; updated=${updated}; skipped=${skipped}; failed=${failed}`);
  }
  console.log(`\n${DRY ? "DRY-RUN â€” would have updated" : "updated"}: ${updated} | skipped(complete): ${skipped} | could-not-fill: ${failed}`);
  writeFileSync(path.join(SCRIPT_DIR, "complete-685-report.txt"), report.join("\n"), "utf8");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


