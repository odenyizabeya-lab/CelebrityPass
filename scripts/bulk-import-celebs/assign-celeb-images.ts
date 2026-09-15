// Automated profile-photo provisioning for every celebrity.
// Source: the lead image of each celebrity's ALREADY identity-verified
// Wikipedia article (Google-style knowledge panel), served from Wikimedia
// Commons with an explicit, checkable license. Never the "first Google image".
// License gate: CC0 / Public Domain / CC BY / CC BY-SA / GFDL only; anything
// fair-use, non-free, unknown, or "ND" (no-derivatives, we crop) is REJECTED.
// Quality gates: minimum resolution + sane portrait/square aspect; then sharp
// crops to a clean 960x1280 portrait. Never overwrites an imageVerified
// celebrity. Dry-run unless BULK_DRY=0. Reports every decision to
// scripts/bulk-import-celebs/images-report.{json,txt}.
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

function licenseOk(info: FileInfo): boolean {
  const meta = info?.extmetadata ?? {};
  const lic = String(meta.LicenseShortName?.value ?? "").toLowerCase();
  const usage = String(meta.UsageTerms?.value ?? "").toLowerCase();
  const text = `${lic} ${usage}`;
  if (/cc\s*by-nd|fair use|non.?free|unknown|no license|no known|copyrighted/i.test(text)) return false;
  return /cc0|public domain|cc by|gfdl|attribution/i.test(text);
}

function usable(mime: string, w: number, h: number): { status: "ok" } | { status: "reject"; reason: string } {
  if (w < 600 || h < 450) return { status: "reject", reason: `too small ${w}x${h}` };
  const ratio = h / w;
  if (ratio < 0.45) return { status: "reject", reason: `too landscape ${w}x${h}` };
  if (ratio > 2.4) return { status: "reject", reason: `too tall ${w}x${h}` };
  if (!/image\/(jpeg|png|webp)/i.test(mime)) return { status: "reject", reason: `mime ${mime}` };
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
  const re =
    /\/wikipedia\/commons\/thumb\/(?:[0-9a-f]\/[0-9a-f]{2}|[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2})\/([^/]+)\//.exec(
      clean,
    ) ?? /\/wikipedia\/commons\/(?:[0-9a-f]\/[0-9a-f]{2}|[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2})\/([^/]+)$/.exec(clean);
  return re ? decodeURIComponent(re[1]) : null;
}

async function toDataUri(buf: Buffer): Promise<string> {
  const out = await sharp(buf)
    .rotate()
    .resize({ width: 960, height: 1280, fit: "cover", position: "attention" })
    .jpeg({ quality: 86, progressive: true })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

async function processOne(c: {
  id: string;
  name: string;
  slug: string;
  googleInfo: string | null;
  profileImage: string | null;
  imageVerified: boolean;
}): Promise<Result> {
  const base = { slug: c.slug, name: c.name } as Result;
  if (c.imageVerified) return { ...base, status: "skipped_verified" };
  if (c.profileImage && c.profileImage.trim()) return { ...base, status: "skipped_existing_image" };
  const title = await titleOf(c.googleInfo);
  if (!title) return { ...base, status: "reject", reason: "no knowledge panel anchor" };
  let summary: Summary;
  try {
    summary = (await apiJson("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_")))) as Summary;
  } catch (e) {
    return { ...base, status: "reject", reason: "summary fetch failed", detail: String(e instanceof Error ? e.message : e).slice(0, 80) };
  }
  const img = summary?.originalimage ?? summary?.thumbnail;
  const src = String(img?.source ?? "");
  if (!src) return { ...base, status: "reject", reason: "article has no lead image" };
  const file = fileNameFrom(src);
  if (!file) return { ...base, status: "reject", reason: "lead image not on Commons", detail: src.slice(0, 90) };
  let info: FileInfo | null = null;
  try {
    info = await fileInfo("File:" + file);
  } catch {
    info = null;
  }
  if (!info) return { ...base, status: "reject", reason: "file info unavailable" };
  const gate = usable(info.mime ?? "", info.width ?? 0, info.height ?? 0);
  if (gate.status !== "ok") return { ...base, status: "reject", reason: gate.reason, detail: `${file}` };
  if (!licenseOk(info)) {
    const lic = String(info.extmetadata?.LicenseShortName?.value ?? "") || "no short license";
    return { ...base, status: "reject", reason: `license rejected (${lic})`, detail: `${file}` };
  }
  const meta = info.extmetadata ?? {};
  const artist = stripHtml(String(meta.Artist?.value ?? "")) || stripHtml(String(meta.Credit?.value ?? "")) || "";
  const assign: Result = {
    ...base,
    status: DRY ? "ok" : "ready",
    article: title,
    file,
    license: String(meta.LicenseShortName?.value ?? ""),
    attribution: artist,
    sourceUrl: String(info.descriptionurl ?? ""),
    mediaUrl: String(info.url ?? ""),
    width: info.width,
    height: info.height,
  };
  if (DRY) return assign;
  let buf: ArrayBuffer;
  try {
    buf = await fetch(String(info.thumburl ?? src), {
      headers: UA,
      signal: AbortSignal.timeout(60000),
    }).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("download failed"))));
  } catch (e) {
    return { ...base, status: "reject", reason: "download failed", detail: String(e instanceof Error ? e.message : e).slice(0, 60) };
  }
  let uri: string;
  try {
    uri = await toDataUri(Buffer.from(buf));
  } catch {
    return { ...base, status: "reject", reason: "decode/process failed", detail: `${file}` };
  }
  assign.uri = uri;
  assign.hash = createHash("sha256").update(uri).digest("hex") + ":" + randomUUID().slice(0, 8);
  return assign;
}

async function writeBack(prisma: import("@prisma/client").PrismaClient, r: Result): Promise<boolean> {
  const data = {
    profileImage: r.uri as string,
    profileImageHash: r.hash as string,
    imageVerified: true,
    imageStatus: "verified",
    imageSource: "wikimedia-commons",
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
  const { prisma } = await import("@/lib/db");
  const celebs = await prisma.celebrity.findMany({
    select: { id: true, name: true, slug: true, googleInfo: true, profileImage: true, imageVerified: true },
    orderBy: { name: "asc" },
  });
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