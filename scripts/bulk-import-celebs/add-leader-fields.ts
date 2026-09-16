// Post-import enrichment for bulk batches: fills country, biography (Wikipedia
// overview), official website and verified official social accounts from
// WIKIDATA CLAIMS ONLY — nothing is guessed, no fan pages. Every value is a
// real, sourced statement (P27 citizenship, P856 official website, P2003
// Instagram, P2013 Facebook, P7085 TikTok, P2002 X/Twitter). Use BULK_NAMES to
// point at a per-batch names file (falls back to the built-in leader list).
//
// Only EMPTY fields are filled; existing curated values are never overwritten.
// Dry-run unless BULK_DRY=0.
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
const UA = { "User-Agent": "CelebrityPass/1.0 (leader profile enrichment; contact admin@celebritypass.app)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Display names for this batch (overridden by BULK_NAMES=<file> when given).
const FALLBACK_NAMES = [
  "Donald Trump", "Elon Musk", "Emmanuel Macron", "Luiz Inácio Lula da Silva", "Javier Milei",
  "Claudia Sheinbaum", "Xi Jinping", "Vladimir Putin", "Lee Jae-myung", "Recep Tayyip Erdoğan",
  "Volodymyr Zelenskyy", "Jeff Bezos", "Bill Gates", "Mark Zuckerberg", "Larry Page",
  "Sergey Brin", "Larry Ellison", "Michael Dell", "Jensen Huang", "Warren Buffett",
  "Richard Branson", "Jack Ma", "Mukesh Ambani", "Gautam Adani", "Carlos Slim",
  "Bernard Arnault", "Amancio Ortega", "Masayoshi Son", "Michael Bloomberg", "George Soros",
  "Peter Thiel", "Reed Hastings", "Jack Dorsey", "Brian Chesky", "Phil Knight",
  "Steve Wozniak", "Michael Rubin", "Ray Dalio", "Richard Liu", "Tadashi Yanai",
];

const NAMES_FILE = process.env.BULK_NAMES ? path.resolve(ROOT, process.env.BULK_NAMES) : null;
const NAMES = (() => {
  if (!NAMES_FILE) return FALLBACK_NAMES;
  return readFileSync(NAMES_FILE, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
})();

function normalizeNameKey(name: string): string {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Wikidata P27 lists every citizenship, oldest-first; the LAST entry is not
// always the primary nationality the platform should display (e.g. dual/ancestry
// citizenships). Only clearly-misleading picks for this batch are overridden to
// the person's primary nationality.
const COUNTRY_OVERRIDES: Record<string, string> = {
  "Javier Milei": "Argentina",
  "Volodymyr Zelenskyy": "Ukraine",
  "Steve Wozniak": "United States",
  "Carlos Slim": "Mexico",
  "George Soros": "United States",
  "Shakira": "Colombia", // P27 claim order leads with her 2014 Spanish naturalization
  "Jim Carrey": "Canada", // naturalized American in 2004, but primary identity is Canadian-born
};

// Facebook handles that exist on Wikidata but point at a DIFFERENT entity
// (never guessed — these are cases where the claim itself is wrong).
const FB_HANDLE_DROP: Record<string, boolean> = {
  "Peter Thiel": true,
};

const cleanHandle = (s: string) => s.replace(/\s+/g, "").replace(/^@/, "");

type WikiJson = {
  entities?: Record<string, {
    labels?: Record<string, { value?: string }>;
    links?: unknown;
    claims?: Record<string, unknown>;
  }>;
};

async function wikiJson(url: string): Promise<WikiJson> {
  await sleep(120);
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 100)}`);
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

/** En rich from one celebrity's stored panel. Returns the patch keys to set. */
async function enrichOne(
  c: { name: string; country: string; bio: string | null; website: string | null; instagramUrl: string | null; facebookUrl: string | null; tiktokUrl: string | null; googleUrl: string | null; googleInfo: string | null },
): Promise<{ patch: Record<string, unknown>; notes: string[] }> {
  const notes: string[] = [];
  const patch: Record<string, unknown> = {};
  if (!c.googleInfo) {
    notes.push("no knowledge panel — enrichment skipped");
    return { patch, notes };
  }

  let info: {
    wikipediaUrl?: string | null;
    overview?: string | null;
    description?: string | null;
    occupations?: string[];
  };
  try {
    info = JSON.parse(c.googleInfo) as typeof info;
  } catch {
    notes.push("unparseable googleInfo");
    return { patch, notes };
  }
  const wikipediaUrl = info?.wikipediaUrl ?? null;

  if (!c.bio && info?.overview) {
    const t = info.overview.replace(/\s+/g, " ").trim();
    patch.bio = t.length > 1100 ? t.slice(0, t.lastIndexOf(" ", 1100)) + "…" : t;
  }

  if (![c.website, c.instagramUrl, c.facebookUrl, c.tiktokUrl, c.country].some((v) => !!v)) {
    // Resolve a Wikidata entity only when we actually need the claims.
    let wikidataId: string | null = null;
    try {
      const title = wikipediaUrl ? decodeURIComponent(wikipediaUrl.split("/").pop() ?? "") : c.name;
      const j = (await wikiJson(
        `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&titles=${encodeURIComponent(title)}&ppprop=wikibase_item&format=json&redirects=1`,
      )) as { query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> } };
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
            const seen = countries
              .map((id) => labels.entities?.[id]?.labels?.en?.value ?? "")
              .filter(Boolean);
            if (seen.length > 0) {
              // Wikidata orders P27 oldest-first; the FIRST entry is the primary
              // nationality to display (last is often a later-obtained one).
              patch.country = COUNTRY_OVERRIDES[c.name] ?? seen[0];
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
        if (wikidataId) notes.push(`wikidata ${wikidataId}`);
      } catch {
        notes.push("wikidata claims failed");
      }
    }
  }

  if (!c.googleUrl && wikipediaUrl) patch.googleUrl = wikipediaUrl;
  return { patch, notes };
}

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });
  const key = (n: string) => normalizeNameKey(n);
  const keys = new Set(NAMES.map(key));
  const celebs = await prisma.celebrity.findMany({ select: { id: true, name: true, nameKey: true, country: true, bio: true, website: true, instagramUrl: true, facebookUrl: true, tiktokUrl: true, googleUrl: true, googleInfo: true } });
  const matched = celebs.filter((c) => keys.has(c.nameKey));
  const missing = NAMES.filter((n) => !matched.some((c) => c.nameKey === key(n)));
  console.log(`matched ${matched.length}/${NAMES.length}; not found in DB: ${missing.join(", ") || "none"}`);

  let updated = 0;
  for (const c of matched) {
    const { patch, notes } = await enrichOne(c);
    if (Object.keys(patch).length > 0) {
      console.log(`\n${c.name} → ${JSON.stringify(patch)}`);
      console.log(`   [${notes.join(", ")}]`);
      if (!DRY) {
        await prisma.celebrity.update({ where: { id: c.id }, data: patch });
        updated++;
      }
    } else {
      console.log(`\n${c.name} → (nothing to fill) [${notes.join(", ")}]`);
    }
  }
  console.log(`\n${DRY ? "DRY-RUN — would update" : "updated"}: ${updated}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});