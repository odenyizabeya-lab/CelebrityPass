// Bulk import of celebrity communities from scripts/bulk-import-celebs/names.txt
// into the LIVE CelebrityPass database, reusing the exact same helpers the
// admin "create celebrity" route uses (auto avatar/cover, follower placeholders,
// unique fan numbers, base tiers + premium ladder, Google/Wikipedia panel).
// This guarantees feature parity with manually-created communities. It NEVER
// sends announcement emails and NEVER writes images.
//
// Safety:
//   - DRY-RUN unless BULK_DRY=0
//   - Skips names already in the DB (accent/case/punctuation-insensitive)
//   - Resumable: re-running continues where it stopped
//   - BULK_MAX_NEW caps new rows per run
//   - Creates are sequential per person; panel lookups use a small pool so the
//     public Wikipedia/Wikidata APIs are never hammered.
//
// Run from the repo root:
//   npx tsx scripts/bulk-import-celebs/import-celebs.ts   # dry run (default)
//   BULK_DRY=0 BULK_MAX_NEW=25 npx tsx scripts/bulk-import-celebs/import-celebs.ts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { upsertPremiumLevels } from "../../prisma/premium-levels.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..");
// Optional per-run names file (e.g. BULK_NAMES=scripts/bulk-import-celebs/world-leaders.txt).
const NAMES_FILE = process.env.BULK_NAMES ? path.resolve(ROOT, process.env.BULK_NAMES) : path.join(SCRIPT_DIR, "names.txt");
const REPORT_FILE = path.join(SCRIPT_DIR, "run-report.json");

// Load .env before anything touches @prisma/client (it reads DATABASE_URL at
// construction time from the environment).
function loadEnv() {
  try {
    const text = readFileSync(path.join(ROOT, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m || line.trim().startsWith("#")) continue;
      const key = m[1];
      if (!(key in process.env)) process.env[key] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env — rely on ambient environment */
  }
}
loadEnv();

const DRY = process.env.BULK_DRY !== "0";
const MAX_NEW = Number(process.env.BULK_MAX_NEW) > 0 ? Number(process.env.BULK_MAX_NEW) : Infinity;
const POOL = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Display-name corrections (same person → exactly ONE canonical profile).
const RENAMES: Record<string, string> = {
  "V (Kim Taehyung)": "V",
  'Michael "Bully" Herbig': "Michael Bully Herbig",
  "Jeon Ji-hyun": "Jun Ji-hyun", // alternate romanization of the same actress
};

// Excluded from the bulk import (can be added manually from the admin panel later).
const EXCLUDED: Record<string, string> = {
  "R. Kelly": "excluded by operator request",
};

async function main() {
  const { prisma } = await import("@/lib/db");
  const { slugify, avatarDataUri, coverDataUri } = await import("@/lib/utils");
  const { defaultFollowerCounts } = await import("@/lib/followers");
  const { normalizeNameKey } = await import("@/lib/dedupe");
  const { assignFanNumber, fameTier, maxFollowers } = await import("@/lib/fame");
  const { sanitizeBaseMemberships } = await import("@/lib/memberships");
  const { fetchGoogleInfo } = await import("@/lib/google-info");

  // 0) Parse + normalize the list -------------------------------------------
  const rawLines = readFileSync(NAMES_FILE, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const seenKeys = new Map<string, string>(); // normalized key -> kept display name
  const droppedDup = new Map<string, string>(); // key -> kept first spelling
  const droppedExcluded: string[] = [];
  for (const raw of rawLines) {
    if (raw in EXCLUDED) {
      droppedExcluded.push(raw);
      continue;
    }
    const name = RENAMES[raw] ?? raw;
    const key = normalizeNameKey(name);
    if (!key) continue;
    if (seenKeys.has(key)) {
      droppedDup.set(key, seenKeys.get(key)!);
      continue;
    }
    seenKeys.set(key, name);
  }

  // 1) Cross-check against the ENTIRE current database ----------------------
  const existing = await prisma.celebrity.findMany({
    select: { id: true, slug: true, name: true, nameKey: true },
  });
  const existingByKey = new Map(existing.map((c) => [c.nameKey, c]));
  const skippedExisting: string[] = [];
  const toInsert: { name: string; key: string }[] = [];
  for (const [key, name] of seenKeys) {
    if (existingByKey.has(key)) {
      const hit = existingByKey.get(key)!;
      skippedExisting.push(`${name} — already in DB as "${hit.name}" (/celebrity/${hit.slug})`);
    } else {
      toInsert.push({ name, key });
    }
  }

  console.log("=== BULK IMPORT REPORT ===");
  console.log(
    JSON.stringify(
      {
        mode: DRY ? "DRY-RUN (no writes)" : `LIVE WRITES${Number.isFinite(MAX_NEW) ? ` — capped at ${MAX_NEW} this run` : ""}`,
        namesParsed: rawLines.length,
        uniqueAfterNormalize: seenKeys.size,
        exactDuplicateVariantsMerged: droppedDup.size,
        excludedCount: droppedExcluded.length,
        alreadyInDatabase: existing.length,
        willSkipExisting: skippedExisting.length,
        willInsert: toInsert.length,
      },
      null,
      2,
    ),
  );
  console.log("\nExcluded names:", JSON.stringify(droppedExcluded));
  console.log("Duplicate-variant pairs merged (kept first spelling):");
  for (const [key, first] of droppedDup) console.log(`  key=${key} kept="${first}"`);
  console.log("\nAlready in DB (skipped):");
  for (const s of skippedExisting) console.log(`  - ${s}`);

  if (DRY) {
    console.log("\n[dry run] nothing was written. Set BULK_DRY=0 to run for real.");
    await prisma.$disconnect();
    return;
  }

  // 2) Google/Wikipedia panel lookahead (small pool) -------------------------
  const slice = toInsert.slice(0, MAX_NEW);
  console.log(`\nLoading knowledge panels for ${slice.length} names (pool ${POOL})…`);
  const panels = new Map<string, Awaited<ReturnType<typeof fetchGoogleInfo>>>();
  let done = 0;
  let idx = 0;
  const workers = Array.from({ length: POOL }, async () => {
    while (idx < slice.length) {
      const i = idx++;
      const item = slice[i];
      try {
        const info = await fetchGoogleInfo(item.name, { profession: "", category: "" });
        panels.set(item.key, info);
} catch {
          panels.set(item.key, null);
        } finally {
          done++;
          await sleep(300);
          if (done % 25 === 0 || done === slice.length) console.log(`  panels ${done}/${slice.length}`);
        }
    }
  });
  await Promise.all(workers);
  const withPanel = [...panels.values()].filter((p) => p !== null).length;
  console.log(`  knowledge panels found for ${withPanel}/${slice.length}`);

  // 3) Creates with a small worker pool (mirrors the admin create route). ------
  // Parallelism is safe: fan numbers are unique-constrained and retried inside
  // assignFanNumber; nameKey/slug conflicts resolve to P2002 re-check.
  const CREATE_POOL = 3;
  let created = 0;
  let failed = 0;
  const createdSlugs: string[] = [];

  async function createOne(item: { name: string; key: string }) {
    const info = panels.get(item.key) ?? null;
    const kind = (info as { kind?: "actor" | "musician" | "athlete" | "other" } | null)?.kind;
    const category = kind === "actor" ? "Actor" : kind === "musician" ? "Musician" : kind === "athlete" ? "Athlete" : "Public Figure";
    const occupations = (info as { occupations?: string[] } | null)?.occupations ?? [];
    const profession = String(occupations[0] ?? "").slice(0, 120);
    const accent = "#8b5cf6";
    const followers = defaultFollowerCounts(category, item.name);
    const maxF = maxFollowers(followers);
    const tier = fameTier(info as Parameters<typeof fameTier>[0], maxF);

    let slug = slugify(item.name);
    if (!slug) slug = item.key || `celebrity-${Date.now().toString(36)}`;

    let celebrity: { id: string; name: string; slug: string } | undefined;
    for (let attempt = 0; attempt < 4 && !celebrity; attempt++) {
      try {
        celebrity = await prisma.celebrity.create({
          data: {
            slug: attempt === 0 ? slug : `${slug}-${Date.now().toString(36).slice(-5)}`,
            nameKey: item.key,
            name: item.name,
            category,
            country: "",
            city: null,
            profession,
            bio: null,
            profileImage: avatarDataUri(item.name, accent),
            profileImageHash: null,
            coverImage: coverDataUri(accent),
            coverImageHash: null,
            accentColor: accent,
            isFeatured: false,
            isActive: true,
            isVerified: true,
            socialLinks: null,
            facebookUrl: null,
            instagramUrl: null,
            tiktokUrl: null,
            googleUrl: null,
            cardDesign: null,
            website: null,
            googleInfo: info ? JSON.stringify(info) : null,
            instagramFollowers: followers.instagramFollowers ?? null,
            tiktokFollowers: followers.tiktokFollowers ?? null,
            facebookFollowers: followers.facebookFollowers ?? null,
            followersUpdatedAt: new Date(),
          },
        });
      } catch (e) {
        if ((e as { code?: string })?.code !== "P2002") throw e;
        const race = await prisma.celebrity.findFirst({ where: { nameKey: item.key }, select: { id: true } });
        if (race) break; // another worker created it — handled below
      }
    }
    if (!celebrity) {
      const now = await prisma.celebrity.findFirst({ where: { nameKey: item.key }, select: { name: true } });
      if (now) console.warn(`  skipped (appeared during run): ${item.name}`);
      else {
        failed++;
        console.error(`  FAILED to create: ${item.name}`);
        return;
      }
    } else {
      const baseTiers = sanitizeBaseMemberships(undefined);
      if (baseTiers.length) {
        await prisma.membershipLevel.createMany({
          data: baseTiers.map((t, i) => ({
            celebrityId: celebrity.id,
            name: t.name,
            description: t.description,
            price: t.price,
            currency: t.currency,
            displayOrder: i,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }
      try {
        await upsertPremiumLevels(prisma, celebrity);
      } catch {
        try {
          await upsertPremiumLevels(prisma, celebrity);
        } catch (err2) {
          console.error(`  premium ladder failed for ${item.name}:`, err2);
        }
      }
      await assignFanNumber(celebrity.id, celebrity.slug, tier);
      createdSlugs.push(celebrity.slug);
    }

    created++;
    if (created % 25 === 0) console.log(`  created ${created}/${slice.length}`);
  }

  let nextIdx = 0;
  const createWorkers = Array.from({ length: CREATE_POOL }, async () => {
    while (nextIdx < slice.length) {
      const i = nextIdx++;
      await createOne(slice[i]);
    }
  });
  await Promise.all(createWorkers);

  console.log("\n=== IMPORT DONE ===");
  console.log(`created: ${created}   failed: ${failed}   (this run capped at ${slice.length})`);
  console.log("new slugs:", JSON.stringify(createdSlugs));

  writeFileSync(
    REPORT_FILE,
JSON.stringify(
        {
          at: new Date().toISOString(),
          created,
          failed,
          panelsFound: withPanel,
          createdSlugs,
        },
        null,
        2,
      ),
    "utf8",
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
});