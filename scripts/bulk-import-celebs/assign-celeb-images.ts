// Automated profile-photo provisioning for every celebrity.
// Source: the lead image of each celebrity's ALREADY identity-verified
// Wikipedia article (Google-style knowledge panel), served from Wikimedia
// Commons with an explicit, checkable license. Never the "first Google image".
// License gate: free licenses (CC0 / Public Domain / CC BY / CC BY-SA / GFDL /
// FAL) are preferred and marked verified. Everything else is still APPLIED so
// every community has a real face, but flagged imageStatus=unchecked-license /
// imageVerified=false for honest review.
// Quality gates: relaxed (>=300px, sane aspect) so the maximum number of
// communities gets a photo; small sources are upscaled gently to 640x854
// instead of blown up to 960x1280. Existing REAL photos are never overwritten,
// but the auto-generated SVG initials placeholder IS replaced. If the Wikipedia
// summary has no lead image, the Google knowledge panel image is used as a last
// resort (flagged unverified). No celebrity is ever deleted. Dry-run unless
// BULK_DRY=0. Reports every decision to
// scripts/bulk-import-celebs/images-report.{json,txt}.
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
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

// Supabase's pooler URL is used as-is. Bulk writes are kept strictly serial
// (phase B in main) so Prisma prepared statements never churn across pooled
// sessions — that is what triggers Postgres "prepared statement does not exist"
// (26000) under parallel writes.

const DRY = process.env.BULK_DRY !== "0";
const POOL = Number(process.env.IMAGE_POOL ?? 12);
const UA = { "User-Agent": "CelebrityPass/1.0 (bulk image provisioning; contact admin@celebritypass.app)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Result = {
  slug: string;
  name: string;
  status: string;
  reason?: string;
  detail?: string;
  article?: string;
  file?: string;
  license?: string;
  attribution?: string;
  sourceUrl?: string;
  mediaUrl?: string;
  width?: number;
  height?: number;
  uri?: string;
  hash?: string;
  verified?: boolean;
  srcKind?: string;
};

interface SummaryImage {
  source?: string;
}
interface Summary {
  originalimage?: SummaryImage | null;
  thumbnail?: SummaryImage | null;
}
interface FileInfoMeta {
  LicenseShortName?: { value?: string };
  UsageTerms?: { value?: string };
  Artist?: { value?: string };
  Credit?: { value?: string };
}
interface FileInfo {
  url?: string;
  descriptionurl?: string;
  thumburl?: string;
  mime?: string;
  width?: number;
  height?: number;
  extmetadata?: FileInfoMeta;
}

async function apiJson(url: string): Promise<unknown> {
  await sleep(100);
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 120)}`);
  return res.json();
}

function stripHtml(s: string): string {
  return String(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function fileInfo(fileTitle: string): Promise<FileInfo | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&titles=" +
    encodeURIComponent(fileTitle) +
    "&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1600&format=json";
  const j = (await apiJson(url)) as { query?: { pages?: Record<string, { imageinfo?: FileInfo[] }> } };
  const page = Object.values(j.query?.pages ?? {})[0];
  return page?.imageinfo?.[0] ?? null;
}

function looksLikeRealPhoto(uri: string | null): boolean {
  return !!uri && /^data:image\/(jpeg|png|webp);/i.test(uri);
}

/**
 * License triage. `ok` means a clearly free license (verified). Everything
 * else is still APPLIED (so every community gets a face) but flagged for
 * honest review. Only truly non-free terms are called out via ok=false too —
 * the caller applies in both cases, it only changes the verified flag.
 */
function licenseInfo(info: FileInfo): { ok: boolean; short: string } {
  const meta = info?.extmetadata ?? {};
  const lic = String(meta.LicenseShortName?.value ?? "").toLowerCase();
  const usage = String(meta.UsageTerms?.value ?? "").toLowerCase();
  const text = `${lic} ${usage}`;
  const free = /cc0|public domain|cc by|gfdl|free art|fal|attribution|created by/i.test(text);
  const nonFree = /cc by-nd|fair use|non.?free|no known|copyrighted|non.?commercial/i.test(text);
  return { ok: free && !nonFree, short: String(meta.LicenseShortName?.value ?? "") || "unlisted-license" };
}

function usable(mime: string, w: number, h: number): { status: "ok" } | { status: "reject"; reason: string } {
  if (w < 180 || h < 180) return { status: "reject", reason: `too small ${w}x${h}` };
  const ratio = h / w;
  if (ratio < 0.12) return { status: "reject", reason: `too landscape ${w}x${h}` };
  if (ratio > 4) return { status: "reject", reason: `too tall ${w}x${h}` };
  if (!/image\/(jpeg|png|webp|tiff)/i.test(mime)) return { status: "reject", reason: `mime ${mime}` };
  return { status: "ok" };
}

async function titleOf(infoJson: string | null): Promise<string> {
  try {
    const j = JSON.parse(infoJson ?? "");
    const u = String(j.wikipediaUrl ?? "");
    if (!u) return "";
    return decodeURIComponent(u.split("/").pop() ?? "").replace(/_/g, " ");
  } catch {
    return "";
  }
}

function fileNameFrom(source: string): string | null {
  const clean = source.split(/[?#]/)[0];
  // Covers both Commons (/wikipedia/commons/thumb/...) and localized Wikipedia
  // uploads (/wikipedia/en/thumb/... etc.).
  const re =
    /\/wikipedia\/[^/]+\/thumb\/(?:[0-9a-f]\/[0-9a-f]{2}|[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2})\/([^/]+)\//.exec(
      clean,
    ) ?? /\/wikipedia\/[^/]+\/(?:[0-9a-f]\/[0-9a-f]{2}|[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2})\/([^/]+)$/.exec(clean);
  return re ? decodeURIComponent(re[1]) : null;
}

async function toDataUri(buf: Buffer, sourceW?: number, sourceH?: number): Promise<string> {
  const meta = await sharp(buf).metadata().catch(() => null);
  const w = sourceW && sourceW > 0 ? sourceW : (meta?.width ?? 960);
  const h = sourceH && sourceH > 0 ? sourceH : (meta?.height ?? 1280);
  // Gentle upscaling for small sources: cap the output stream so we never blow
  // a ~200px photo up to 960px (blurry mush). Freely-croppable cover fit keeps
  // the 4:5 PORTRAIT shape that the cards expect.
  const small = w < 640 || h < 480;
  const target = small ? { width: 480, height: 640 } : { width: 960, height: 1280 };
  const out = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ ...target, fit: "cover", position: "attention" })
    .jpeg({ quality: 86, progressive: true })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

/**
 * Last-resort lead image: the first photo in the stored Google-style
 * knowledge panel, used when the Wikipedia summary has no lead image.
 */
function panelImageFallback(googleInfo: string | null): string | null {
  try {
    const j = JSON.parse(googleInfo ?? "") as { image?: { url?: string }; images?: { url?: string }[] } | null;
    return j?.image?.url ?? j?.images?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

/** Every image embedded in an article — last resort when the lead/pageimage/
 * panel leads are all unusable (e.g. Dr. Dre's lead is just his signature). */
async function wikipediaArticleImages(title: string): Promise<string[]> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&titles=" +
    encodeURIComponent(title) +
    "&prop=images&imlimit=30&format=json";
  const j = (await apiJson(url)) as { query?: { pages?: Record<string, { images?: { title: string }[] }> } };
  const page = Object.values(j?.query?.pages ?? {})[0];
  return (page?.images ?? []).map((im) => String(im.title ?? ""));
}

/** File titles that are decorative (signature, logo, poster, map, diagram). */
const DECORATIVE_RE = /\.(svg|ico|gif|tif|tiff)$/i;
const DECORATIVE_NAME_RE = /sig(nature)?|logo|emblem|coat_of_arms|map|diagram|poster|cover|banner|window|graph|chart|seat|flag|plaque|gravestone|tomb|grave/i;

/** Wikipedia's PageImages prop — catches lead images the summary API misses. */
async function pageImageUrl(title: string): Promise<string> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&titles=" +
    encodeURIComponent(title) +
    "&prop=pageimages&piprop=original&format=json";
  const j = (await apiJson(url)) as { query?: { pages?: Record<string, { original?: { source?: string } }> } };
  const page = Object.values(j.query?.pages ?? {})[0];
  return page?.original?.source ?? "";
}

/**
 * Disambiguation-aware article lookup. "Tabu" and "LEA" are disambiguation
 * pages with no lead image; the summary API then has nothing to offer, so we
 * search for the matching article and pageimages via its page id.
 */
async function wikipediaSearchArticle(title: string): Promise<{ pageid: number; title: string } | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=" +
    encodeURIComponent(title);
  const j = (await apiJson(url)) as {
    query?: { search?: { pageid: number; title: string; snippet: string }[] };
  };
  for (const hit of j?.query?.search ?? []) {
    const t = String(hit.title ?? "");
    if (!t) continue;
    if (/disambiguation/i.test(String(hit.snippet ?? ""))) continue;
    return { pageid: Number(hit.pageid), title: t };
  }
  return null;
}

async function pageImageByPageId(pageid: number): Promise<string> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&pageids=" +
    pageid +
    "&prop=pageimages&piprop=original&format=json";
  const j = (await apiJson(url)) as { query?: { pages?: Record<string, { original?: { source?: string } }> } };
  const page = j?.query?.pages?.[String(pageid)];
  return page?.original?.source ?? "";
}

type ImageCandidate = { src: string; info: FileInfo | null; label: string };

async function processOne(c: {
  id: string;
  name: string;
  slug: string;
  googleInfo: string | null;
  profileImage: string | null;
  imageVerified: boolean;
}): Promise<Result> {
  const base = { slug: c.slug, name: c.name } as Result;
  // Only a REAL photo protects a celebrity from being refreshed. The
  // auto-generated SVG initials placeholder is NOT a photo — it gets replaced.
  const hasReal = looksLikeRealPhoto(c.profileImage);
  if (c.imageVerified && hasReal) return { ...base, status: "skipped_verified" };
  if (hasReal) return { ...base, status: "skipped_existing_image" };

  // Fall back to the plain name when the knowledge panel has no Wikipedia link.
  let title = await titleOf(c.googleInfo);
  if (!title) title = c.name;

  const downloadAndAssign = async (cand: ImageCandidate): Promise<Result> => {
    const { src, info, label } = cand;
    if (info) {
      const gate = usable(info.mime ?? "", info.width ?? 0, info.height ?? 0);
      if (gate.status !== "ok") return { ...base, status: "reject", reason: gate.reason, detail: label };
    }
    let buf: Buffer;
    try {
      buf = Buffer.from(
        await fetch(src, { headers: UA, signal: AbortSignal.timeout(60000) }).then((r) =>
          r.ok ? r.arrayBuffer() : Promise.reject(new Error("download failed")),
        ),
      );
    } catch (e) {
      return { ...base, status: "reject", reason: "download failed", detail: String(e instanceof Error ? e.message : e).slice(0, 60) };
    }
    let uri: string;
    try {
      uri = await toDataUri(buf, info?.width ?? 0, info?.height ?? 0);
    } catch {
      return { ...base, status: "reject", reason: "decode/process failed", detail: label };
    }
    // License gate is triage, not a reject: the photo is ALWAYS applied so the
    // community has a real face; only the "verified" flag / status differ.
    const lic = info ? licenseInfo(info) : { ok: false, short: "unlisted-license (fallback)" };
    const meta = info?.extmetadata ?? {};
    const artist =
      info
        ? stripHtml(String(meta.Artist?.value ?? "")) || stripHtml(String(meta.Credit?.value ?? "")) || ""
        : "";
    const assign: Result = {
      ...base,
      status: DRY ? "ok" : "ready",
      article: title,
      file: fileNameFrom(src) ?? label,
      license: lic.short,
      attribution: artist,
      sourceUrl: info ? String(info.descriptionurl ?? "") : src,
      mediaUrl: src,
      width: info?.width,
      height: info?.height,
      verified: lic.ok,
      srcKind: info ? "wikipedia" : "panel-fallback",
    };
    if (DRY) return assign;
    assign.uri = uri;
    assign.hash = createHash("sha256").update(uri).digest("hex") + ":" + randomUUID().slice(0, 8);
    return assign;
  };

  // Candidate sources in priority order: the Wikipedia lead image (with license
  // metadata), then Wikipedia's PageImages, then the stored knowledge-panel
  // photo. The first that passes the (relaxed) gates wins.
  const candidates: ImageCandidate[] = [];
  let src = "";
  let summaryFailed = false;
  try {
    const summary = (await apiJson("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_")))) as Summary;
    src = String((summary?.originalimage ?? summary?.thumbnail)?.source ?? "");
  } catch {
    summaryFailed = true;
  }
  if (src) {
    const file = fileNameFrom(src) ?? "";
    let info: FileInfo | null = null;
    if (file) {
      try {
        info = await fileInfo("File:" + file);
      } catch {
        info = null;
      }
    }
    candidates.push({ src, info, label: file || title });
  }
  let pageImg = "";
  if (!src || summaryFailed) {
    try {
      pageImg = await pageImageUrl(title);
    } catch {
      pageImg = "";
    }
  }
  if (pageImg && pageImg !== src) candidates.push({ src: pageImg, info: null, label: "pageimages" });
  const panelFallback = panelImageFallback(c.googleInfo);
  if (panelFallback && panelFallback !== src && panelFallback !== pageImg) {
    candidates.push({ src: panelFallback, info: null, label: "panel-fallback" });
  }
  if (candidates.length === 0) {
    // Tried the exact article title and the stored panel image; last resort:
    // search for the matching article (handles "Tabu" -> "Tabu (actress)").
    try {
      const page = await wikipediaSearchArticle(title);
      if (page) {
        const img = await pageImageByPageId(page.pageid);
        if (img) candidates.push({ src: img, info: null, label: "search-fallback" });
      }
    } catch {
      // ignore — the next check reports the real "no image" verdict
    }
  }
  if (candidates.length === 0) {
    return { ...base, status: "reject", reason: "no lead image on article or panel" };
  }
  let firstReject: Result | null = null;
  for (const cand of candidates) {
    const res = await downloadAndAssign(cand);
    if (!res.reason) return res;
    if (!firstReject) firstReject = res;
  }
  // Last resort: walk the article's other embedded images (skipping
  // signatures/logos/posters) — e.g. Dr. Dre's lead is only his signature.
  let walkTried = 0;
  try {
    const files = await wikipediaArticleImages(title);
    for (const fileTitle of files) {
      if (walkTried >= 6) break;
      walkTried++;
      if (!fileTitle.startsWith("File:") || DECORATIVE_RE.test(fileTitle)) continue;
      if (DECORATIVE_NAME_RE.test(fileTitle.split(":")[1] ?? "")) continue;
      let info: FileInfo | null;
      try {
        info = await fileInfo(fileTitle);
      } catch {
        continue;
      }
      if (!info?.thumburl) continue;
      const gate = usable(info.mime ?? "", info.width ?? 0, info.height ?? 0);
      if (gate.status !== "ok") continue;
      const res = await downloadAndAssign({ src: info.thumburl, info, label: fileTitle });
      if (!res.reason) return res;
    }
  } catch {
    // ignore — fall through to the honest "no safe image" verdict
  }
  return firstReject ?? { ...base, status: "reject", reason: "no usable image from any source" };
}

async function writeBack(prisma: import("@prisma/client").PrismaClient, r: Result): Promise<boolean> {
  const verified = !!r.verified;
  const data = {
    profileImage: r.uri as string,
    profileImageHash: r.hash as string,
    imageVerified: verified,
    imageStatus: verified ? "verified" : "unchecked-license",
    imageSource: r.srcKind === "panel-fallback" ? "panel-fallback" : "wikimedia-commons",
    imageSourceUrl: r.sourceUrl,
    imageLicense: r.license,
    imageAttribution: r.attribution || null,
    imageMediaUrl: r.mediaUrl,
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.celebrity.update({ where: { slug: r.slug }, data });
      return true;
    } catch {
      await sleep(800 * (attempt + 1));
    }
  }
  return false;
}

async function main() {
  // Use the direct (migration) connection for a long-running script: the
  // Supabase transaction pooler aggressively drops idle/long sessions
  // ("Server has closed the connection", statement timeout 57014).
  if (process.env.MIGRATION_DATABASE_URL) process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
  const prisma = new PrismaClient({ log: ["error"] });
  // The Supabase pooler occasionally drops an idle session; retry the read.
  let celebs: { id: string; name: string; slug: string; googleInfo: string | null; profileImage: string | null; imageVerified: boolean }[] = [];
  for (let attempt = 0; attempt < 4 && celebs.length === 0; attempt++) {
    try {
      celebs = await prisma.celebrity.findMany({
        select: { id: true, name: true, slug: true, googleInfo: true, profileImage: true, imageVerified: true },
        orderBy: { name: "asc" },
      });
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  if (celebs.length === 0) throw new Error("could not read celebrities after retries");
  const results: Result[] = [];
  let i = 0;
  while (i < celebs.length) {
    const batch = celebs.slice(i, i + POOL);
    i += POOL;
    const outcomes = await Promise.all(batch.map(processOne));
    for (const o of outcomes) {
      results.push(o);
      console.log(`${o.slug.padEnd(34)} ${(o.status + (o.reason ? " (" + o.reason + ")" : "")).padEnd(45)} ${o.file ?? ""}`);
    }
  }
  if (!DRY) {
    const work = results.filter((r) => r.status === "ready");
    console.log(`\napplying ${work.length} images (serial writes):`);
    let wrote = 0;
    let failed = 0;
    for (const r of work) {
      const ok = await writeBack(prisma, r);
      if (ok) {
        wrote++;
        r.status = "applied";
        delete r.uri;
        delete r.hash;
      } else {
        failed++;
        r.status = "reject";
        r.reason = "db write failed after retries";
        delete r.uri;
        delete r.hash;
      }
      if (wrote % 20 === 0) console.log(`  ...${wrote} written`);
    }
    console.log(`written: ${wrote}, failed: ${failed}`);
  }
  const assigned = results.filter((r) => r.status === "ok" || r.status === "applied");
  const rejected = results.filter((r) => r.status === "reject");
  const report = {
    run: DRY ? "dry" : "apply",
    total: celebs.length,
    assigned: assigned.length,
    rejected: rejected.length,
    assignments: assigned,
    rejects: rejected,
  };
  const reportPath = path.join(SCRIPT_DIR, "images-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  const review = assigned.filter((a) => (a.width ?? 0) / (a.height ?? 1) > 1.5 || (a.width ?? 0) < 900);
  const lines: string[] = [];
  lines.push(`IMAGE REPORT (${report.run}) — ${celebs.length} celebrities, ${assigned.length} usable, ${rejected.length} no safe image`);
  lines.push("");
  lines.push("--- IMAGE NOT VERIFIED (no legally verified image) ---");
  for (const r of rejected) {
    lines.push(`${r.name} — ${r.reason} ${r.detail ?? ""}`.trim());
  }
  lines.push("");
  lines.push("--- VISUAL REVIEW SUGGESTED (landscape/low-res lead images) ---");
  for (const a of review) lines.push(`${a.name} (${a.width}x${a.height}, ${a.file})`);
  writeFileSync(path.join(SCRIPT_DIR, "images-report.txt"), lines.join("\n"), "utf8");
  console.log(`\n${report.run.toUpperCase()}: ${assigned.length}/${celebs.length} usable; ${rejected.length} IMAGE NOT VERIFIED; review list ${review.length}`);
  console.log(`report: scripts/bulk-import-celebs/images-report.{json,txt}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});