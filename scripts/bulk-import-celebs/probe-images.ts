// Feasibility probe: for a handful of celebrities, resolve the lead image of
// their (already identity-verified) Wikipedia article and report the Commons
// license + available width, using the exact flow the real pipeline will use.
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
    const key = m[1];
    if (!(key in process.env)) process.env[key] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const UA = { "User-Agent": "CelebrityPass/1.0 (bulk image provisioning; contact admin@celebritypass.app)" };
const WAIT_MS = 250;

async function getJson(url: string) {
  await new Promise((r) => setTimeout(r, WAIT_MS));
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

async function licenseForFile(fileTitle: string) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&titles=" +
    encodeURIComponent(fileTitle) +
    "&prop=imageinfo&iiprop=url|extmetadata|size&format=json";
  const j = await getJson(url);
  const page = Object.values(j.query?.pages ?? {})[0] as { imageinfo?: any[] };
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata ?? {};
  const license = meta.LicenseShortName?.value ?? "";
  const usage = meta.UsageTerms?.value ?? "";
  const artist = meta.Artist?.value ? String(meta.Artist.value).replace(/<[^>]+>/g, "").slice(0, 120) : "";
  const credit = meta.Credit?.value ? String(meta.Credit.value).replace(/<[^>]+>/g, "").slice(0, 120) : "";
  return {
    filename: fileTitle,
    license,
    usage,
    artist,
    credit,
    width: ii.width,
    height: ii.height,
    thumbUrl: ii.thumburl,
  };
}

const FAVORITES = ["Sting", "Brad Pitt", "IU", "Sasha", "Cro", "Cristiano Ronaldo", "Leonardo DiCaprio", "Slash"];

async function main() {
  const { prisma } = await import("@/lib/db");
  const celebs = await prisma.celebrity.findMany({
    where: { name: { in: FAVORITES } },
    select: { name: true, slug: true, googleInfo: true },
  });
  let ok = 0;
  for (const c of celebs) {
    let title = "";
    try {
      const j = JSON.parse(c.googleInfo ?? "");
      const u = j.wikipediaUrl ?? "";
      title = decodeURIComponent(u.split("/").pop() ?? "").replace(/_/g, " ");
    } catch {}
    if (!title) {
      console.log(`${c.name.padEnd(22)} NO PANEL -> no anchor, IMAGE NOT VERIFIED`);
      continue;
    }
    try {
      const j = await getJson(
        "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_")),
      );
      const img = j?.originalimage ?? j?.thumbnail;
      if (!img?.source) {
        console.log(`${c.name.padEnd(22)} no lead image on article`);
        continue;
      }
      const m = /\/wikipedia\/commons\/thumb\/(?:[0-9a-f]\/[0-9a-f]{2}|[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2})\/([^/]+)\//.exec(img.source) ??
        /\/wikipedia\/commons\/(?:[0-9a-f]\/[0-9a-f]{2}|[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2})\/([^/]+)$/.exec(img.source) ??
        null;
      const safeName = m?.[1] ? decodeURIComponent(m[1].split(/[?#]/)[0]) : null;
      if (!safeName) {
        console.log(`${c.name.padEnd(22)} could not derive file name from ${img.source.slice(0, 80)}`);
        continue;
      }
      const lic = await licenseForFile("File:" + safeName);
      if (!lic) {
        console.log(`${c.name.padEnd(22)} FILE-INFO FAIL src=${img.source.slice(0, 110)} name="${safeName}"`);
        continue;
      }
      const usable =
        /public domain|cc0|cc by|attribution/i.test(lic.license) && !/fair|non.?free/i.test(lic.license);
      ok += usable ? 1 : 0;
      console.log(
        `${c.name.padEnd(22)} ${usable ? "USABLE " : "reject "} ${String(lic.license).padEnd(18)} ${String(
          lic.width,
        ).padStart(4)}px  "${title}"`,
      );
    } catch (e: any) {
      console.log(`${c.name.padEnd(22)} ERROR ${e.message}`);
    }
  }
  console.log(`\nusable: ${ok}/${FAVORITES.length}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});