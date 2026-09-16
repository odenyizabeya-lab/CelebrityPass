// READ-ONLY: classify every stored profile image and validate it LIVE at the
// production routes (the exact bytes/redirects browsers get).
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
if (/pooler\.supabase\.com/i.test(process.env.DATABASE_URL ?? "") && process.env.DIRECT_DATABASE_URL) process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL;
const prisma = new PrismaClient({ log: ["error"] });
const db = async <T>(fn: () => Promise<T>): Promise<T> => {
  for (let i = 0; i < 4; i++) {
    try { return await fn(); }
    catch (e) { if (i === 3) throw e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw new Error("unreachable");
};

const BASE = "https://celebritypass.app";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const rows = await db(() =>
    prisma.celebrity.findMany({
      select: { slug: true, name: true, profileImage: true, coverImage: true, imageStatus: true, imageLicense: true },
      orderBy: { slug: "asc" },
    })
  );

  let http = 0, data = 0, none = 0, special = 0, nonUpload = 0, weird = 0;
  const specials: string[] = [];
  const nonUploads: string[] = [];
  console.log("== STORAGE CLASSIFICATION ==");
  for (const r of rows) {
    const v = r.profileImage ?? "";
    if (!v) { none++; continue; }
    if (v.startsWith("data:")) { data++; continue; }
    if (/^https?:\/\//i.test(v)) {
      http++;
      const m = /^(?:https?:)?\/\/([^/]+)(\/\S*)$/i.exec(v);
      const host = m ? m[1].toLowerCase() : "";
      const p = m ? m[2] : "";
      if (/Special:(FilePath|Redirect\/file|crop)/i.test(p)) { special++; specials.push(`${r.slug} ${v.slice(0, 110)}`); }
      else if (!host.includes("upload.wikimedia.org") && !host.includes("commons.wikimedia.org")) { nonUpload++; nonUploads.push(`${r.slug} ${host} ${v.slice(0, 100)}`); }
    } else { weird++; }
  }
  console.log(`profileImage storage: http=${http} dataURI=${data} empty=${none} weird=${weird}`);
  console.log(`-- Special:(FilePath|Redirect|crop) URLs: ${special} --`);
  specials.forEach((s) => console.log("   " + s));
  console.log(`-- non-wikimedia-upload hosts: ${nonUpload} --`);
  nonUploads.forEach((s) => console.log("   " + s));

  console.log("\n== LIVE CHECK of /images/{slug}/profile ==");
  const broken: { slug: string; name: string; route: string; final: string; status: number; ctype: string; suffix: string }[] = [];
  const okData: string[] = [];
  let okRedirect = 0, notFound = 0;
  let n = 0;
  for (const r of rows) {
    n++;
    const url = `${BASE}/images/${r.slug}/profile`;
    let res: Response;
    try { res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "manual" }); }
    catch (e) { broken.push({ slug: r.slug, name: r.name, route: url, final: `ERR ${(e as Error).message.slice(0, 60)}`, status: -1, ctype: "", suffix: "" }); continue; }
    if (res.status === 307 || res.status === 302) {
      const target = res.headers.get("location") ?? "";
      // validate the final upstream target
      let finalRes: Response;
      let status = -1, ctype = "", suffix = "";
      try {
        finalRes = await fetch(target, { headers: { "User-Agent": UA }, redirect: "follow" });
        status = finalRes.status;
        ctype = (finalRes.headers.get("content-type") ?? "");
        const url2 = finalRes.url ?? "";
        suffix = url2.split("/").pop()?.split("?")[0] ?? "";
        const isImage = ctype.startsWith("image/");
        if (!isImage || status >= 400) {
          broken.push({ slug: r.slug, name: r.name, route: url, final: target.slice(0, 140), status, ctype, suffix });
          await sleep(60);
          continue;
        }
        // drain a bit to keep connections clean
        await finalRes.body?.cancel();
      } catch (e) {
        broken.push({ slug: r.slug, name: r.name, route: url, final: `UPSTREAM ERR ${(e as Error).message.slice(0, 60)} @ ${target.slice(0, 80)}`, status, ctype, suffix });
        await sleep(60);
        continue;
      }
      okRedirect++;
    } else if (res.status === 200) {
      const ctype = res.headers.get("content-type") ?? "";
      if (ctype.startsWith("image/")) okData.push(`${r.slug} ${ctype}`);
      else broken.push({ slug: r.slug, name: r.name, route: url, final: `route returned ${ctype}`, status: 200, ctype, suffix: "" });
    } else if (res.status === 404) { notFound++; }
    else { broken.push({ slug: r.slug, name: r.name, route: url, final: `route status ${res.status}`, status: res.status, ctype: "", suffix: "" }); }
    await res.body?.cancel();
    if (n % 50 === 0) console.log(`  ...${n}/${rows.length}`);
    await sleep(35);
  }

  console.log(`verified OK: dataURI-served=${okData.length}, redirect-served=${okRedirect}, route-404=${notFound}, BROKEN=${broken.length}/${rows.length}`);
  console.log("\n== BROKEN / IMAGE NOT SHOWING ==");
  for (const b of broken) console.log(`${b.slug} | ${b.name} | route->${b.final} | ${b.status} ${b.ctype} ${b.suffix ? "| " + b.suffix : ""}`);

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exitCode = 1; });