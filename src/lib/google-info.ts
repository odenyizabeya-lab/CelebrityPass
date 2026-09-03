// Google-style knowledge-panel info for a single celebrity, sourced from
// Wikipedia + Wikidata (the same public sources that power Google's panel).
//
// Design: never invent information. Data is fetched live from Wikipedia/Wikidata
// ("standard"/summary REST API, parser API, and wikibase claims) and cached so
// page loads are instant and we don't hammer the public APIs on every view.
//
// The fallback on ANY failure is to return null — callers keep their existing
// profile data. We never fabricate an overview.

export type GoogleInfo = {
  name: string;
  description: string | null; // e.g. "American actor (born 1963)"
  born: { iso: string; display: string } | null; // date of birth
  age: number | null; // computed age
  occupations: string[]; // e.g. ["Actor","Producer","Musician"]
  films: string[]; // titled film credits, e.g. ["Pirates…","Edward Scissorhands"]
  overview: string | null; // the Google-style encyclopedic overview paragraph
  wikipediaUrl: string | null;
  source: "wikipedia/wikidata";
  fetchedAt: string;
};

const UA = "CelebrityPass/1.0 (celebrity profile enrichment; contact@celebritypass.app)";

// Simple in-process TTL cache: keeps the panel warm across page views without a
// DB write. Short-lived is fine; admin refresh forces a live fetch.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const cache = new Map<string, { at: number; data: GoogleInfo }>();

export function getCachedGoogleInfo(name: string): GoogleInfo | null {
  const hit = cache.get(normalizeForLookup(name));
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch JSON with retries on transient (429/5xx) HTTP errors. */
async function fetchJson(url: string, tries = 3): Promise<Record<string, unknown>> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.ok && res.status < 300) return (await res.json()) as Record<string, unknown>;
      last = new Error(`HTTP ${res.status}`);
      // Back off on rate-limit / server errors rather than failing the panel.
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

function normalizeForLookup(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Resolve a Wikipedia page + its Wikidata entity id from an exact celebrity name. */
async function resolvePage(name: string): Promise<{ pageTitle: string; oldid: string; wikidataId: string | null }> {
  const q = encodeURIComponent(name);
  const res = (await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&titles=${q}&format=json&ppprop=wikibase_item&redirects=1`
  )) as {
    query?: { pages?: Record<string, { title?: string; pageprops?: { wikibase_item?: string } }> };
  };
  const pages = res && res.query ? res.query.pages : undefined;
  const page = pages ? Object.values(pages)[0] : undefined;
  if (!page || !page.title) throw new Error("Wiki page not found");
  return { pageTitle: page.title, oldid: `0`, wikidataId: page.pageprops?.wikibase_item ?? null };
}

/** Fetch the REST summary for a pageTitle, or null. */
async function pageSummary(pageTitle: string): Promise<{ extract?: string; description?: string; type?: string; detail?: string } | null> {
  try {
    return (await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`)) as {
      extract?: string;
      description?: string;
      type?: string;
      detail?: string;
    };
  } catch {
    return null;
  }
}

/**
 * Cascade of candidate suffixes to try when a bare name lands on a
 * disambiguation or non-biographical page (common for one-word stage names
 * like "V", "RM", "Jin").
 */
function personSuffixes(profession: string, category: string): string[] {
  const ctx = `${profession} ${category}`.toLowerCase();
  const suf = new Set<string>([]);
  if (ctx.includes("sing") || ctx.includes("vocal")) suf.add("singer");
  if (ctx.includes("rapper") || ctx.includes("hip")) suf.add("rapper");
  if (ctx.includes("music") || ctx.includes("produc")) suf.add("musician");
  if (ctx.includes("actor") || ctx.includes("actress")) suf.add("actor");
  if (ctx.includes("artist")) suf.add("artist");
  if (ctx.includes("football") || ctx.includes("soccer") || ctx.includes("basketb")) suf.add("footballer");
  if (ctx.includes("cricketer") || ctx.includes("cricket")) suf.add("cricketer");
  if (ctx.includes("model")) suf.add("model");
  if (ctx.includes("comedian")) suf.add("comedian");
  return [...suf];
}

/**
 * Is the Wikidata entity an actual human (or has a known occupation)? This is
 * what lets us reject pages like the letter "V" or a band (instance of human
 * Q5 / occupation P106 present).
 */
async function isHumanEntity(wikidataId: string | null): Promise<boolean> {
  if (!wikidataId) return false;
  try {
    const ent = (await fetchJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=claims&format=json`
    )) as { entities?: Record<string, { claims?: Record<string, unknown> }> };
    const claims = ent?.entities?.[wikidataId]?.claims ?? {};
    const claim = (arr: unknown) => (Array.isArray(arr) ? arr : []) as { mainsnak?: { datavalue?: { value?: unknown } } }[];
    // instance of (P31) human (Q5)
    if (claim(claims["P31"]).some((c) => (c.mainsnak?.datavalue?.value as { id?: string })?.id === "Q5")) return true;
    // has an occupation (P106)
    if (claim(claims["P106"]).length > 0) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve the correct *person* page for a celebrity. Tries the bare name, then
 * profession/category-derived suffixes, accepting only a page whose Wikidata
 * entity is an actual human. Returns null when no real person page is found.
 */
async function resolvePersonPage(
  name: string,
  profession: string,
  category: string
): Promise<{ pageTitle: string; wikidataId: string | null; description: string | null } | null> {
  const candidates = [name, ...personSuffixes(profession, category).map((s) => `${name} (${s})`)];
  for (const cand of candidates) {
    try {
      const { pageTitle, wikidataId } = await resolvePage(cand);
      const sum = await pageSummary(pageTitle);
      if (sum && sum.type === "disambiguation") continue; // keep trying suffixes
      if (sum && sum.detail && !sum.extract) continue; // missing page
      // Reject non-humans (bands, letters, disambiguations) — only people get a panel.
      if (!(await isHumanEntity(wikidataId))) continue;
      return { pageTitle, wikidataId, description: sum?.description ?? null };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Fetch a celebrity's Google-style information. Pass `force` to bypass the cache.
 * `profession`/`category` are used to disambiguate common names (e.g. the BTS
 * member "V" vs the letter V) by retrying with a suffix like "(singer)".
 * Returns null on any failure so the caller uses its existing profile data.
 */
export async function fetchGoogleInfo(
  name: string,
  opts: { force?: boolean; profession?: string; category?: string } = {}
): Promise<GoogleInfo | null> {
  const key = normalizeForLookup(name);
  if (!opts.force && cache.has(key)) {
    const hit = cache.get(key)!;
    return Date.now() - hit.at < CACHE_TTL_MS ? hit.data : null;
  }
  try {
    const resolved = await resolvePersonPage(name, opts.profession ?? "", opts.category ?? "");
    if (!resolved) return null;
    const { pageTitle, wikidataId, description } = resolved;

    const info: GoogleInfo = {
      name,
      description,
      born: null,
      age: null,
      occupations: [],
      films: [],
      overview: null,
      wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`,
      source: "wikipedia/wikidata",
      fetchedAt: new Date().toISOString(),
    };

    // 1) Overview from Wikipedia REST summary.
    try {
      const sum = (await fetchJson(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
      )) as { extract?: string; description?: string; type?: string; detail?: string };
      if (sum && typeof sum.extract === "string" && sum.extract) info.overview = sum.extract;
      if (sum && typeof sum.description === "string") info.description = info.description ?? sum.description;
    } catch {
      /* overview is optional */
    }

    // 2) Born + occupations + films from Wikidata when an entity exists.
    if (wikidataId) {
      const ent = (await fetchJson(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=claims|descriptions&languages=en&format=json`
      )) as { entities?: Record<string, { claims?: Record<string, unknown>; descriptions?: Record<string, { value?: string }> }> };
      const e = ent && ent.entities ? ent.entities[wikidataId] : undefined;
      if (e) {
        if (!info.description && e.descriptions && e.descriptions.en?.value) {
          info.description = e.descriptions.en.value;
        }
        const claims = e.claims ?? {};
        const birth = firstClaimValue(claims["P569"] ?? [], "time");
        if (birth) {
          const d = parseWikidataDate(birth as string);
          if (d) {
            info.born = { iso: d.iso, display: d.display };
            if (typeof d.age === "number") info.age = d.age;
          }
        }
        const occIds = claimEntityIds(claims["P106"]);
        if (occIds.length) {
          try {
            const labels = await resolveEntityLabels(occIds);
            info.occupations = dedupe(occIds.map((id) => labels[id]).filter((l): l is string => !!l));
          } catch {
            info.occupations = [];
          }
        }
      }
    }

    // 3) Film titles from the Wikipedia article's filmography table.
    try {
      info.films = await fetchFilmTitles(pageTitle);
    } catch {
      info.films = [];
    }

    cache.set(key, { at: Date.now(), data: info });
    return info;
  } catch {
    return null;
  }
}

/** Extract the first datavalue `key` from a wikibase claim array. */
function firstClaimValue(claims: unknown, key: string): unknown {
  const arr = Array.isArray(claims) ? claims : [];
  const c = arr[0] as { mainsnak?: { datavalue?: { value?: Record<string, unknown> | string } } } | undefined;
  const v = c?.mainsnak?.datavalue?.value;
  if (v && typeof v === "object") return (v as Record<string, unknown>)[key];
  return v;
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

async function resolveEntityLabels(ids: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).join("|");
    const res = (await fetchJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch}&props=labels&languages=en&format=json`
    )) as { entities?: Record<string, { labels?: Record<string, { value?: string }> }> };
    for (const [id, e] of Object.entries(res?.entities ?? {})) {
      if (e?.labels?.en?.value) map[id] = e.labels.en.value;
    }
  }
  return map;
}

function parseWikidataDate(time: string): { iso: string; display: string; age: number } | null {
  // Format: +1963-06-09T00:00:00Z  (precision down to day)
  const m = /^\+?(-?\d{1,4})-(\d{2})-(\d{2})/.exec(time ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const iso = `${String(y).padStart(4, "0")}-${m[2]}-${m[3]}`;
  const display = `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mo - 1]} ${d}, ${y}`;
  let age = 0;
  const now = new Date();
  const b = new Date(y, mo - 1, d);
  age = now.getFullYear() - b.getFullYear();
  if (
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())
  ) {
    age -= 1;
  }
  return { iso, display, age };
}

async function fetchFilmTitles(pageTitle: string): Promise<string[]> {
  const u = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
    pageTitle
  )}&prop=text&format=json&disablelimitreport=1`;
  const res = (await fetchJson(u)) as { parse?: { text?: { "*"?: string } } };
  const html = res?.parse?.text?.["*"];
  if (!html) return [];
  const seen = new Set<string>();
  const titles: string[] = [];
  const re = /<i><a[^>]*>([^<]+)<\/a><\/i>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].replace(/&amp;/g, "&").trim();
    const kept = raw.replace(/\((film|film series|series)\)$/i, "").trim();
    if (!kept || seen.has(kept)) continue;
    seen.add(kept);
    titles.push(kept);
    if (titles.length >= 12) break; // show a representative set like Google does
  }
  return titles;
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr.filter((x) => x !== undefined)));
}