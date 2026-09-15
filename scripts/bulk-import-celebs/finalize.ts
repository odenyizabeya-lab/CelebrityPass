// Repair pass for bulk-import-celebs: makes every community complete regardless
// of interrupted runs or rate-limited panel lookups. Idempotent.
//   - refetch googleInfo for any celebrity missing it (gentle pacing)
//   - assign a fan number where missing
//   - top up base Silver→VIP tiers + premium ladder to the full 20 levels
// Run: npx tsx scripts/bulk-import-celebs/finalize.ts
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";
import { upsertPremiumLevels } from "../../prisma/premium-levels.mjs";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { prisma } = await import("@/lib/db");
  const { assignFanNumber, fameTier, maxFollowers } = await import("@/lib/fame");
  const { sanitizeBaseMemberships } = await import("@/lib/memberships");
  const { defaultFollowerCounts } = await import("@/lib/followers");
  const { fetchGoogleInfo } = await import("@/lib/google-info");

  const all = await prisma.celebrity.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      nameKey: true,
      category: true,
      profession: true,
      googleInfo: true,
      displayFanCount: true,
      tiktokFollowers: true,
      instagramFollowers: true,
      facebookFollowers: true,
    },
  });

  const baseTiers = sanitizeBaseMemberships(undefined);
  const needsPanel = all.filter((c) => !c.googleInfo);
  const BROAD_HINT = "singer vocalist rapper musician producer actor actress artist footballer model comedian";
  const needsFan = all.filter((c) => c.displayFanCount == null);
  const needsTiers: typeof all = [];
  const tierCounts = await prisma.membershipLevel.groupBy({ by: ["celebrityId"], _count: true });
  const counts = new Map(tierCounts.map((t) => [t.celebrityId, t._count]));
  for (const c of all) if ((counts.get(c.id) ?? 0) < 20) needsTiers.push(c);

  console.log(
    `celebrities: ${all.length} | missing panel: ${needsPanel.length} | missing fan number: ${needsFan.length} | tiers < 20: ${needsTiers.length}`,
  );

  if (DRY) {
    console.log("[dry run] would repair those. Set BULK_DRY=0 to apply.");
    await prisma.$disconnect();
    return;
  }

  // 1) Panel refetch (gentle: pool 2, 300ms spacing)
  let fixedPanel = 0;
  let idx = 0;
  const workers = Array.from({ length: 2 }, async () => {
    while (idx < needsPanel.length) {
      const i = idx++;
      const c = needsPanel[i];
      try {
        const primary = await fetchGoogleInfo(c.name, { profession: c.profession, category: c.category });
        const info = primary ?? (await fetchGoogleInfo(c.name, { profession: BROAD_HINT, category: "" }).catch(() => null));
        if (info) {
          await prisma.celebrity.update({ where: { id: c.id }, data: { googleInfo: JSON.stringify(info) } });
          fixedPanel++;
        }
      } catch {
        /* keep retryable */
      } finally {
        await sleep(300);
      }
    }
  });
  await Promise.all(workers);
  console.log(`panels refetched: ${fixedPanel}/${needsPanel.length}`);

  // 2) Fan numbers
  for (const c of needsFan) {
    let info = null;
    if (c.googleInfo) {
      try {
        info = JSON.parse(c.googleInfo);
      } catch {
        /* ignore */
      }
    }
    const followers =
      c.instagramFollowers != null || c.tiktokFollowers != null || c.facebookFollowers != null
        ? {
            instagramFollowers: c.instagramFollowers,
            tiktokFollowers: c.tiktokFollowers,
            facebookFollowers: c.facebookFollowers,
          }
        : defaultFollowerCounts(c.category, c.name);
    const maxF = maxFollowers(followers);
    const tier = fameTier(info as Parameters<typeof fameTier>[0], maxF);
    await assignFanNumber(c.id, c.slug, tier);
  }
  console.log(`fan numbers assigned: ${needsFan.length}`);

  // 3) Tier top-up to the full 20 levels
  for (const c of needsTiers) {
    const existing = await prisma.membershipLevel.findMany({ where: { celebrityId: c.id }, select: { name: true } });
    const have = new Set(existing.map((t) => t.name));
    const missingBase = baseTiers.filter((t) => !have.has(t.name));
    if (missingBase.length) {
      await prisma.membershipLevel.createMany({
        data: missingBase.map((t, i) => ({
          celebrityId: c.id,
          name: t.name,
          description: t.description,
          price: t.price,
          currency: t.currency,
          displayOrder: 5 + i,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }
    try {
      await upsertPremiumLevels(prisma, c);
    } catch (err) {
      console.error(`premium ladder failed for ${c.name}:`, err);
    }
  }
  console.log(`tiers topped up for: ${needsTiers.length}`);

  const after = await prisma.membershipLevel.groupBy({ by: ["celebrityId"], _count: true });
  const low = after.filter((t) => t._count < 20).length;
  console.log(`celebs with <20 tiers after repair: ${low}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});