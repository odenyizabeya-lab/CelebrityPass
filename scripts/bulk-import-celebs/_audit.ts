// READ-ONLY audit of the whole celebrity dataset. No writes.
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
const prisma = new PrismaClient({ log: ["error"] });

const trunc = (s?: string | null, n = 40) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

(async () => {
  const all = await prisma.celebrity.findMany({
    select: {
      id: true, slug: true, nameKey: true, name: true, category: true, country: true, city: true,
      bio: true, googleInfo: true, isActive: true, isFeatured: true, displayFanCount: true,
      profileImageHash: true, coverImageHash: true, imageStatus: true, imageLicense: true,
      website: true, instagramUrl: true, facebookUrl: true, tiktokUrl: true, googleUrl: true,
      createdAt: true,
      _count: { select: { memberships: true, fans: true } },
    },
  });
  const mems = await prisma.membershipLevel.count();
  const fans = await prisma.fan.count();
  const evts = await prisma.celebrityEvent.count();
  console.log(`== TOTALS ==`);
  console.log(`celebrities: ${all.length} | memberships(rows): ${mems} | fans: ${fans} | events: ${evts}`);
  const byCat = new Map<string, number>();
  for (const c of all) byCat.set(c.category ?? "(none)", (byCat.get(c.category ?? "(none)") ?? 0) + 1);
  console.log(`categories: ${[...byCat.entries()].map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`featured: ${all.filter((c) => c.isFeatured).length}`);
  console.log(`active: ${all.filter((c) => c.isActive).length} | inactive: ${all.filter((c) => !c.isActive).length}`);
  console.log(`with profile image: ${all.filter((c) => c.profileImageHash).length} | NO image: ${all.filter((c) => !c.profileImageHash).length}`);
  console.log(`with cover image: ${all.filter((c) => c.coverImageHash).length}`);
  console.log(`imageStatus counts: ${JSON.stringify(Object.fromEntries(all.reduce((m, c) => (m.set(c.imageStatus ?? "null", (m.get(c.imageStatus ?? "null") ?? 0) + 1), m), new Map<string, number>()))) }`);
  console.log(`no memberships: ${all.filter((c) => c._count.memberships === 0).length} | no fans: ${all.filter((c) => c._count.fans === 0).length}`);
  console.log(`displayFanCount null: ${all.filter((c) => c.displayFanCount == null).length}`);

  console.log(`\n== INCOMPLETE (missing country or bio or links) ==`);
  for (const c of all) {
    if (!c.isActive) continue;
    const missing: string[] = [];
    if (!c.country) missing.push("country");
    if (!c.bio) missing.push("bio");
    if (!c.googleInfo) missing.push("panel");
    if (!(c.website || c.instagramUrl || c.facebookUrl || c.tiktokUrl)) missing.push("socials");
    if ((!c.profileImageHash)) missing.push("photo");
    if (missing.length && !(missing.length === 1 && missing[0] === "photo" && c.country && c.bio && c.googleInfo && (c.website || c.instagramUrl || c.facebookUrl || c.tiktokUrl))) {
      console.log(`  ${c.name} [${c.slug}] ${c.category ?? "?"}: ${missing.join(",")}`);
    }
  }

  console.log(`\n== NO PROFILE PHOTO (SVG placeholder) ==`);
  for (const c of all.filter((x) => !x.profileImageHash)) console.log(`  ${c.name} [${c.slug}] status=${c.imageStatus ?? "null"} license=${c.imageLicense ?? "null"}`);

  console.log(`\n== slug/nameKey oddities ==`);
  let slugKeyMismatch = 0;
  for (const c of all) {
    const ascii = (c.nameKey ?? "").replace(/[-_]/g, "").trim();
    const noDash = c.slug.replace(/[-_]/g, "").trim();
    if (ascii && ascii !== noDash) {
      slugKeyMismatch++;
      if (slugKeyMismatch <= 15) console.log(`  ${c.name} slug=${c.slug} nameKey=${c.nameKey}`);
    }
  }
  console.log(`slug!=nameKey(as-dashes-removed): ${slugKeyMismatch}`);

  console.log(`\n== category weirdness ==`);
  for (const c of all) {
    if (!c.category || !["Musician", "Actor", "Public Figure", "Athlete", "Creator", "Entertainer", "Comedian", "Director", "Producer", "Model", "Influencer"].includes(c.category)) {
      console.log(`  ${c.name} -> "${c.category}"`);
    }
  }

  console.log(`\n== suspicious bios (very short or dictionary-ish) ==`);
  for (const c of all) {
    if (!c.bio) continue;
    if (/is a (feminine|masculine|given) name/i.test(c.bio) || c.bio.length < 40) console.log(`  ${c.name} (${c.bio.length} ch): ${trunc(c.bio, 70)}`);
  }

  console.log(`\n== bio likely about a DIFFERENT subject (band bio on person or vice versa) ==`);
  for (const c of all) {
    if (!c.bio) continue;
    const words = c.bio.split(/\s+/).slice(0, 8).join(" ").toLowerCase();
    if (/(silbermond|band (from|dating|consisting))/.test(words) && !/silbermond|kloß/i.test(c.name)) {
      console.log(`  ${c.name}: ${trunc(c.bio, 60)}`);
    }
  }

  console.log(`\n== featured list ==`);
  for (const c of all.filter((x) => x.isFeatured).sort((a, b) => (a.name < b.name ? -1 : 1))) console.log(`  ${c.name} [${c.slug}]`);

  console.log(`\n== members per celeb (top/bottom) ==`);
  const byMems = [...all].sort((a, b) => b._count.fans - a._count.fans);
  console.log(`top fans: ` + byMems.slice(0, 5).map((c) => `${c.name}(${c._count.fans})`).join(", "));
  const withFan = all.filter((c) => c._count.fans > 0);
  console.log(`celebs WITH >=1 fan: ${withFan.length} of ${all.length}`);

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exitCode = 1;
});