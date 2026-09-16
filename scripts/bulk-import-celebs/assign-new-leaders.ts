// Targeted profile-photo provisioning for the 26 new world leaders.
// Same logic as assign-celeb-images.ts (Wikipedia lead image with license
// triage, panel fallback), but only touches the provided slugs.
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
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const DRY = process.env.BULK_DRY !== "0";
const UA = { "User-Agent": "CelebrityPass/1.0 (bulk image provisioning; contact admin@celebritypass.app)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SLUGS = [
  "alexander-stubb", "guy-parmelin", "tharman-shanmugaratnam", "isaac-herzog", "ilham-aliyev",
  "prabowo-subianto", "sergio-mattarella", "droupadi-murmu", "mohamed-bin-zayed-al-nahyan", "nicuor-dan",
  "marcelo-rebelo-de-sousa", "petr-pavel", "gitanas-nausda", "nataa-pirc-musar", "frank-walter-steinmeier",
  "aleksandar-vui", "asif-ali-zardari", "catherine-connolly", "karol-nawrocki", "maia-sandu",
  "alexander-van-der-bellen", "gordana-siljanovska-davkova", "cyril-ramaphosa", "jakov-milatovi",
  "bongbong-marcos", "santiago-pea",
];

type Result = { slug: string; name: string; status: string; reason?: string; file?: string; license?: string; verified?: boolean };

async function apiJson(url: string): Promise<unknown> {
  await sleep(100);
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 120)}`);
  return res.json();
}

function stripHtml(s: string): string {
  return String(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function fileInfo(fileTitle: string): Promise<Record<string, unknown> | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&titles=" +
    encodeURIComponent(fileTitle) +
    "&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1600&format=json";
  const j = (await apiJson(url)) as { query?: { pages?: Record<string, { imageinfo?: Record<string, unknown>[] }> } };
  const page = Object.values(j.query?.pages ?? {})[0];
  return page?.imageinfo?.[0] ?? null;
}

function licenseInfo(info: Record<string, unknown>): { ok: boolean; short: string } {
  const meta = (info?.extmetadata ?? {}) as Record<string, { value?: string }>;
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

async function toDataUri(buf: Buffer, sourceW?: number, sourceH?: number): Promise<string> {
  const meta = await sharp(buf).metadata().catch(() => null);
  const w = sourceW && sourceW > 0 ? sourceW : (meta?.width ?? 960);
  const h = sourceH && sourceH > 0 ? sourceH : (meta?.height ?? 1280);
  const small = w < 640 || h < 480;
  const target = small ? { width: 480, height: 640 } : { width: 960, height: 1280 };
  const out = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ ...target, fit: "cover", position: "attention" })
    .jpeg({ quality: 86, progressive: true })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

type Candidate = { src: string; info: Record<string, unknown> | null; label: string };

async function processOne(c: { name: string; slug: string; googleInfo: string | null }): Promise<Result> {
  const base = { slug: c.slug, name: c.name } as Result;
  let title = c.name;
  try {
    const g = c.googleInfo ? JSON.parse(c.googleInfo) : null;
    const u = String(g?.wikipediaUrl ?? "");
    if (u) title = decodeURIComponent(u.split("/").pop() ?? "").replace(/_/g, " ");
  } catch {}

  const downloadAndAssign = async (cand: Candidate): Promise<Result> => {
    const { src, info, label } = cand;
    if (info) {
      const gate = usable(String(info.mime ?? ""), Number(info.width ?? 0), Number(info.height ?? 0));
      if (gate.status !== "ok") return { ...base, status: "reject", reason: gate.reason, detail: label } as Result;
    }
    let buf: Buffer;
    try {
      buf = Buffer.from(
        await fetch(src, { headers: UA, signal: AbortSignal.timeout(60000) }).then((r) =>
          r.ok ? r.arrayBuffer() : Promise.reject(new Error("download failed")),
        ),
      );
    } catch (e) {
      return { ...base, status: "reject", reason: "download failed", detail: String(e instanceof Error ? e.message : e).slice(0, 60) } as Result;
    }
    let uri: string;
    try {
      uri = await toDataUri(buf, info ? Number(info.width ?? 0) : 0, info ? Number(info.height ?? 0) : 0);
    } catch {
      return { ...base, status: "reject", reason: "decode/process failed", detail: label } as Result;
    }
    const lic = info ? licenseInfo(info) : { ok: false, short: "unlisted-license (fallback)" };
    const assign: Result = {
      ...base,
      file: label,
      license: lic.short,
      verified: lic.ok,
      status: "ready",
    };
    (assign as Record<string, unknown>).uri = uri;
    (assign as Record<string, unknown>).hash = createHash("sha256").update(uri).digest("hex") + ":" + randomUUID().slice(0, 8);
    return assign;
  };

  const candidates: Candidate[] = [];
  let src = "";
  try {
    const summary = (await apiJson("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_")))) as {
      originalimage?: { source?: string };
      thumbnail?: { source?: string };
    };
    src = String((summary?.originalimage ?? summary?.thumbnail)?.source ?? "");
  } catch {}
  if (src) {
    const clean = src.split(/[?#]/)[0];
    const re =
      /\/wikipedia\/[^/]+\/thumb\/(?:[0-9a-f]\/[0-9a-f]{2}|[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2})\/([^/]+)\//.exec(clean) ??
      /\/wikipedia\/[^/]+\/(?:[0-9a-f]\/[0-9a-f]{2}|[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2})\/([^/]+)$/.exec(clean);
    const file = re ? decodeURIComponent(re[1]) : null;
    let info: Record<string, unknown> | null = null;
    if (file) {
      try {
        info = await fileInfo("File:" + file);
      } catch {}
    }
    candidates.push({ src, info, label: file || title });
  }
  try {
    const g = c.googleInfo ? JSON.parse(c.googleInfo) : null;
    const panel = g?.image?.url ?? null;
    if (panel && panel !== src) candidates.push({ src: panel, info: null, label: "panel-fallback" });
  } catch {}

  if (candidates.length === 0) return { ...base, status: "reject", reason: "no lead image on article or panel" };
  for (const cand of candidates) {
    const res = await downloadAndAssign(cand);
    if (!res.reason) return res;
    if (res.reason) return res; // first candidate wins; report if rejected
  }
  return { ...base, status: "reject", reason: "no usable image from any source" };
}

async function writeBack(prisma: PrismaClient, r: Result): Promise<boolean> {
  const extra = r as Result & { uri: string; hash: string };
  const verified = !!r.verified;
  const data = {
    profileImage: extra.uri,
    profileImageHash: extra.hash,
    imageVerified: verified,
    imageStatus: verified ? "verified" : "unchecked-license",
    imageSource: "wikimedia-commons",
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
  const prisma = new PrismaClient({ log: ["error"] });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (process.env.MIGRATION_DATABASE_URL) process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
      await prisma.$connect();
      break;
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  const celebs = await prisma.celebrity.findMany({
    where: { slug: { in: SLUGS } },
    select: { id: true, name: true, slug: true, googleInfo: true },
    orderBy: { name: "asc" },
  });
  console.log(`processing ${celebs.length} celebrities`);
  const results: Result[] = [];
  for (const c of celebs) {
    const o = await processOne(c);
    results.push(o);
    console.log(`${o.slug.padEnd(32)} ${(o.status + (o.reason ? " (" + o.reason + ")" : "")).padEnd(40)} ${o.file ?? ""}`);
  }
  if (!DRY) {
    const work = results.filter((r) => r.status === "ready");
    let wrote = 0;
    let failedCount = 0;
    for (const r of work) {
      if (await writeBack(prisma, r)) {
        wrote++;
        r.status = "applied";
      } else {
        failedCount++;
        r.status = "reject";
        r.reason = "db write failed after retries";
      }
      const extra = r as Result & { uri?: string; hash?: string };
      delete extra.uri;
      delete extra.hash;
    }
    console.log(`written: ${wrote}, failed: ${failedCount}`);
  }
  writeFileSync(path.join(SCRIPT_DIR, "_new-leaders-images.json"), JSON.stringify({ run: DRY ? "dry" : "apply", results }, null, 2), "utf8");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});