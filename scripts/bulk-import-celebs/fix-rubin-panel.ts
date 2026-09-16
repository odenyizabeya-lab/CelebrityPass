// One-off: fetch a knowledge panel for Michael Rubin (businessman) — the bulk
// import's bare-name lookup collided with another "Michael Rubin" — and store it
// so the enrichment/photo passes can use it. Idempotent (no-op if present).
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

const DRY = process.env.BULK_DRY !== "0";

async function main() {
  const { prisma } = await import("../../src/lib/db.ts");
  const { fetchGoogleInfo } = await import("../../src/lib/google-info.ts");
  const celeb = await prisma.celebrity.findUnique({
    where: { nameKey: "michaelrubin" },
    select: { id: true, name: true, googleInfo: true },
  });
  if (!celeb) throw new Error("Michael Rubin not found");
  const info = await fetchGoogleInfo("Michael Rubin (businessman)", {
    force: true,
    profession: "businessman",
    category: "Public Figure",
  });
  if (!info) {
    console.log("panel fetch failed — leaving as-is");
    await prisma.$disconnect();
    return;
  }
  console.log("panel for:", info.description, "|", info.overview?.slice(0, 120));
  console.log("image:", info.image?.url ?? "(none)");
  if (!DRY) {
    await prisma.celebrity.update({ where: { id: celeb.id }, data: { googleInfo: JSON.stringify(info) } });
    console.log("googleInfo saved.");
  } else {
    console.log("DRY-RUN — googleInfo NOT saved. Set BULK_DRY=0 to apply.");
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});