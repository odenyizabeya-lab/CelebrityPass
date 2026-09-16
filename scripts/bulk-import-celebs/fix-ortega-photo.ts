// One-off: assign Amancio Ortega a real, CC-licensed Commons photo (his article
// only has a coat of arms). Mirrors the assign-celeb-images license-verified path.
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
const DRY = process.env.BULK_DRY !== "0";
const UA = { "User-Agent": "CelebrityPass/1.0 (profile enrichment; contact admin@celebritypass.app)" };

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });
  const celeb = await prisma.celebrity.findUnique({ where: { nameKey: "amancioortega" }, select: { id: true, name: true, profileImage: true } });
  if (!celeb) throw new Error("Amancio Ortega not found");
  const url = "https://upload.wikimedia.org/wikipedia/commons/9/9b/16.05.19-Firma_Fundaci%C3%B3n_Amancio_Ortega_%28cropped%29.jpg";
  const buf = Buffer.from(
    await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) }).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`)))),
  );
  const out = await sharp(buf)
    .rotate()
    .resize({ width: 960, height: 1280, fit: "cover", position: "attention" })
    .jpeg({ quality: 86, progressive: true })
    .toBuffer();
  const uri = `data:image/jpeg;base64,${out.toString("base64")}`;
  const hash = createHash("sha256").update(uri).digest("hex") + ":" + randomUUID().slice(0, 8);
  console.log(`${celeb.name}: jpeg ${buf.length} bytes -> ${uri.length} chars`);
  if (!DRY) {
    await prisma.celebrity.update({
      where: { id: celeb.id },
      data: {
        profileImage: uri,
        profileImageHash: hash,
        imageVerified: true,
        imageStatus: "verified",
        imageSource: "wikimedia-commons",
        imageSourceUrl: "https://commons.wikimedia.org/wiki/File:16.05.19-Firma_Fundaci%C3%B3n_Amancio_Ortega_(cropped).jpg",
        imageLicense: "CC BY-SA 2.0",
        imageAttribution: "Junta de Andalucía",
        imageMediaUrl: url.split("?")[0],
      },
    });
    console.log("saved.");
  } else {
    console.log("DRY-RUN — nothing saved. Set BULK_DRY=0 to apply.");
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});