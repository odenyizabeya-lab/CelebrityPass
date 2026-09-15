// Conservative back-derivation of category for BULK-imported celebrities that
// were left at the generic "Public Figure" placeholder because their knowledge
// panel arrived in the later finalize pass.
//
// Rules (never guess, never invent):
//   - only a celebrity whose category is STILL the "Public Figure" placeholder
//   - only when the panel's kind is unambiguous: the signals text (description +
//     occupations) must contain the role and must NOT contain a conflicting
//     role (so actor-singers like Kad Merad never get a false "Musician")
//   - profession is NEVER touched (hand-curated values stay untouched)
// Dry-run unless BULK_DRY=0.
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
const DRY = process.env.BULK_DRY !== "0";
const hasActor = (s: string) => /\bacto?rs?\b|actress/.test(s);
const hasMusician = (s: string) => /\bsing\w*s?\b|rapper|musician|singer|songwriter/.test(s);

function wantedCategory(info: { kind?: string; description?: string | null; occupations?: string[] }): string | null {
  const kind = info?.kind;
  if (kind === "athlete") return "Athlete";
  const desc = String(info?.description ?? "").toLowerCase();
  const occ = (info?.occupations ?? []).join(" ").toLowerCase();
  const dActor = hasActor(desc);
  const dMus = hasMusician(desc);
  if (dMus && !dActor) return "Musician";
  if (dActor && !dMus) return "Actor";
  // description is ambiguous or empty — fall back to occupations only if they
  // contain a SINGLE unambiguous role signal
  const oActor = hasActor(occ);
  const oMus = hasMusician(occ);
  if (oMus && !oActor) return "Musician";
  if (oActor && !oMus) return "Actor";
  // genuinely ambiguous (actor also sings, singer also acts) — never guess
  return null;
}

async function main() {
  const { prisma } = await import("@/lib/db");
  const celebs = await prisma.celebrity.findMany({
    select: { id: true, name: true, category: true, googleInfo: true },
  });
  const candidates = celebs.filter((c) => c.category === "Public Figure" && c.googleInfo);
  let changed = 0;
  const samples: string[] = [];
  for (const c of candidates) {
    let info: { kind?: string; description?: string | null; occupations?: string[] } | null = null;
    try {
      info = JSON.parse(c.googleInfo as string) as { kind?: string; description?: string | null; occupations?: string[] } | null;
    } catch {
      continue;
    }
    const cat = wantedCategory(info ?? {});
    if (!cat) continue;
    changed++;
    if (samples.length < 25) samples.push(`${c.name} -> ${cat} (kind=${info?.kind})`);
    if (!DRY) {
      await prisma.celebrity.update({ where: { id: c.id }, data: { category: cat } });
    }
  }
  console.log(`placeholder "Public Figure" with panel: ${candidates.length}`);
  console.log(`unambiguous upgrades: ${changed}${DRY ? " (DRY-RUN — set BULK_DRY=0 to apply)" : " — applied"}`);
  for (const s of samples) console.log("  " + s);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});