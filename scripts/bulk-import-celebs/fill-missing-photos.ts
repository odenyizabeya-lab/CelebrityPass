// Fill the last 2 real-photo gaps (LEA, Paolo Pierobon) with license-verified
// Wikimedia Commons photos, using the exact same storage format as
// assign-celeb-images.ts (downscale to portrait JPEG data URI, sha256 hash,
// imageVerified/imageStatus/imageLicense/imageAttribution/imageMediaUrl).
// Dry-run unless BULK_DRY=0.
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
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
if (/pooler\.supabase\.com/i.test(process.env.DATABASE_URL ?? "") && process.env.DIRECT_DATABASE_URL) process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL;

const DRY = process.env.BULK_DRY !== "0";
const UA = { "User-Agent": "CelebrityPass/1.0 (bulk image provisioning; contact admin@celebritypass.app)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// slug -> Commons file title (both confirmed free-licensed via Wikidata P18 / Commons)
const TARGETS: { slug: string; file: string }[] = [
  {
    slug: "lea",
    file: "File:Lea - 2023259142648 2023-09-16 Glücksgefühle Festival - Sven - 1D X MK II - 0386 - B70I4482 (cropped).jpg",
  },
  { slug: "paolo-pierobon", file: "File:Paolo Pierobon.jpg" },
];

function stripHtml(s: string): string {
  return String(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function licenseInfo(meta: any): { ok: boolean; short: string } {
  const lic = String(meta?.LicenseShortName?.value ?? "").toLowerCase();
  const usage = String(meta?.UsageTerms?.value ?? "").toLowerCase();
  const text = `${lic} ${usage}`;
  const free = /cc0|public domain|cc by|gfdl|free art|fal|attribution|created by/i.test(text);
  const nonFree = /cc by-nd|fair use|non.?free|no known|copyrighted|non.?commercial/i.test(text);
  return { ok: free && !nonFree, short: String(meta?.LicenseShortName?.value ?? "") || "unlisted-license" };
}

async function fileInfo(file: string) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&titles=" +
    encodeURIComponent(file) +
    "&prop=imageinfo&iiprop=url|extmetadata|size|mime|descriptionurl&iiurlwidth=1280&format=json";
  const j = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) }).then((r) => r.json());
  const page = Object.values(j?.query?.pages ?? {})[0] as any;
  return page?.imageinfo?.[0] ?? null;
}

async function toDataUri(buf: Buffer, sourceW?: number, sourceH?: number): Promise<string> {
  const meta = await sharp(buf).metadata().catch(() => null);
  const w = sourceW && sourceW > 0 ? sourceW : meta?.width ?? 960;
  const h = sourceH && sourceH > 0 ? sourceH : meta?.height ?? 1280;
  const small = w < 640 || h < 480;
  const target = small ? { width: 480, height: 640 } : { width: 960, height: 1280 };
  const out = await sharp(buf)
    .rotate()
    .resize({ ...target, fit: "cover", position: "attention" })
    .jpeg({ quality: 86, progressive: true })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

(async () => {
  const prisma = new PrismaClient({ log: ["error"] });
  for (const t of TARGETS) {
    let info: any = null;
    try {
      info = await fileInfo(t.file);
    } catch (e) {
      console.log(`${t.slug}: fileInfo failed ${(e as Error).message.slice(0, 60)}`);
      continue;
    }
    if (!info?.url) {
      console.log(`${t.slug}: no imageinfo for ${t.file}`);
      continue;
    }
    const lic = licenseInfo(info?.extmetadata);
    console.log(
      `${t.slug}: mime=${info.mime} ${info.width}x${info.height} license="${lic.short}" verified=${lic.ok}`,
    );
    const dont = /image\/(jpeg|png|webp|tiff)/i.test(info.mime ?? "") && (info.width ?? 0) >= 180 && (info.height ?? 0) >= 180;
    if (!dont) {
      console.log(`${t.slug}: rejected by quality gate`);
      continue;
    }
    const src = info.thumburl || info.url;
    const buf = Buffer.from(
      await fetch(src, { headers: UA, signal: AbortSignal.timeout(60000) }).then((r) =>
        r.ok ? r.arrayBuffer() : Promise.reject(new Error("download failed")),
      ),
    );
    let uri: string;
    try {
      uri = await toDataUri(buf, info.width, info.height);
    } catch (e) {
      console.log(`${t.slug}: decode/process failed ${(e as Error).message.slice(0, 60)}`);
      continue;
    }
    const meta = info?.extmetadata ?? {};
    const artist = stripHtml(String(meta.Artist?.value ?? "")) || stripHtml(String(meta.Credit?.value ?? "")) || "";
    const hash = createHash("sha256").update(uri).digest("hex") + ":" + randomUUID().slice(0, 8);
    const data = {
      profileImage: uri,
      profileImageHash: hash,
      imageVerified: lic.ok,
      imageStatus: lic.ok ? "verified" : "unchecked-license",
      imageSource: "wikimedia-commons",
      imageSourceUrl: String(info.descriptionurl ?? ""),
      imageLicense: lic.short,
      imageAttribution: artist || null,
      imageMediaUrl: String(info.url ?? ""),
    };
    if (DRY) {
      console.log(`${t.slug}: [DRY] would assign ${t.file} -> ${uri.length} chars, license=${lic.short}`);
      continue;
    }
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        await prisma.celebrity.update({ where: { slug: t.slug }, data });
        ok = true;
      } catch (e) {
        await sleep(800 * (attempt + 1));
        if (attempt === 2) console.log(`${t.slug}: db write failed ${(e as Error).message.slice(0, 80)}`);
      }
    }
    console.log(`${t.slug}: ${ok ? "APPLIED" : "FAILED"} ${t.file}`);
  }
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});