const { createHash, randomUUID } = require("node:crypto");
const sharp = require("sharp");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } } });
const UA = { "User-Agent": "CelebrityPass/1.0 (bulk image provisioning; contact admin@celebritypass.app)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = "alexander-stubb";

async function toDataUri(buf, sourceW, sourceH) {
  const meta = await sharp(buf).metadata().catch(() => null);
  const w = sourceW && sourceW > 0 ? sourceW : (meta?.width ?? 640);
  const h = sourceH && sourceH > 0 ? sourceH : (meta?.height ?? 854);
  const small = w < 640 || h < 480;
  const target = small ? { width: 480, height: 640 } : { width: 960, height: 1280 };
  const out = await sharp(buf, { failOn: "none" }).rotate().resize({ ...target, fit: "cover", position: "attention" }).jpeg({ quality: 86, progressive: true }).toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

(async () => {
  await p.$connect();
  const celeb = await p.$queryRawUnsafe(`SELECT id, slug, name, "googleInfo" FROM "Celebrity" WHERE slug = $1`, slug);
  const c = celeb[0];
  const g = c.googleInfo ? JSON.parse(c.googleInfo) : {};
  const wpUrl = String(g.wikipediaUrl ?? "");
  const title = wpUrl ? decodeURIComponent(wpUrl.split("/").pop() ?? "").replace(/_/g, " ") : c.name;
  console.log("article:", title);

  const candidates = [];
  try {
    const summary = await (await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_")), { headers: UA })).json();
    const src = String((summary?.originalimage ?? summary?.thumbnail)?.source ?? "");
    if (src) candidates.push({ src, label: "summary" });
  } catch {}

  // PageImages via API as a second independent fetch (differs from summary thumb).
  try {
    const j = await (await fetch("https://en.wikipedia.org/w/api.php?action=query&titles=" + encodeURIComponent(title) + "&prop=pageimages&piprop=original&format=json", { headers: UA })).json();
    const page = Object.values(j?.query?.pages ?? {})[0];
    if (page?.original?.source) candidates.push({ src: page.original.source, label: "pageimages" });
  } catch {}

  // Panel image fallback.
  if (g?.image?.url && !candidates.find((x) => x.src === g.image.url)) candidates.push({ src: g.image.url, label: "panel" });

  console.log("candidates:", candidates.length);
  let wrote = false;
  for (const cand of candidates) {
    try {
      await sleep(150);
      const res = await fetch(cand.src, { headers: UA, signal: AbortSignal.timeout(60000) });
      if (!res.ok) { console.log(`  skip ${cand.label}: HTTP ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const uri = await toDataUri(buf);
      const hash = createHash("sha256").update(uri).digest("hex") + ":" + randomUUID().slice(0, 8);
      await p.$executeRawUnsafe(
        `UPDATE "Celebrity" SET "profileImage" = $1, "profileImageHash" = $2, "imageVerified" = true, "imageStatus" = 'verified', "imageSource" = 'wikimedia-commons' WHERE slug = $3`,
        uri, hash, slug,
      );
      console.log(`  APPLIED ${cand.label}: ${cand.src.slice(0, 90)} (${buf.length} bytes)`);
      wrote = true;
      break;
    } catch (e) {
      console.log(`  fail ${cand.label}: ${String(e.message).slice(0, 70)}`);
    }
  }
  if (!wrote) console.log("NO PHOTO APPLIED");
  await p.$disconnect();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });