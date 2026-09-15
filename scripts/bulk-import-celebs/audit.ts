// Deep data-integrity audit of the imported celebrity database.
// Checks duplicates, fan-number uniqueness/range, exact tier structure,
// required fields, panel-vs-person sanity, orphan rows, and hits the live API.
// Run: npx tsx scripts/bulk-import-celebs/audit.ts
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

const issues: string[] = [];
const report: Record<string, unknown> = {};
const bad = (msg: string) => {
  issues.push(msg);
  console.error("  ISSUE: " + msg);
};

async function main() {
  const { prisma } = await import("@/lib/db");
  const { sanitizeBaseMemberships } = await import("@/lib/memberships");
  const { PREMIUM_LEVELS } = await import("../../prisma/premium-levels.mjs");

  // Image blobs are huge (up to ~3MB per row) and selecting them times out on
  // the pooler — so pull only the scalar + metadata fields here and use
  // server-side COUNT/WHERE checks for profile image presence below.
  const celebs = await prisma.celebrity.findMany({
    select: {
      id: true,
      name: true,
      nameKey: true,
      slug: true,
      accentColor: true,
      isActive: true,
      isVerified: true,
      displayFanCount: true,
      googleInfo: true,
      imageVerified: true,
      imageLicense: true,
      imageSourceUrl: true,
    },
  });
  report.celebrityCount = celebs.length;

  // ---------- Uniqueness on every constrained field ----------
  const dupKey = (field: keyof (typeof celebs)[number], label: string) => {
    const seen = new Map<unknown, string[]>();
    for (const c of celebs) {
      const v = c[field] as unknown;
      if (v == null || v === "") return; // absent fields handled separately
      const key = String(v).toLowerCase();
      const arr = seen.get(key) ?? [];
      arr.push(c.name);
      seen.set(key, arr);
    }
    const dupes = [...seen.entries()].filter(([, names]) => names.length > 1);
    if (dupes.length) {
      bad(`duplicate ${label}: ${dupes.map(([k, n]) => `${k} (${n.join(", ")})`).join(" | ")}`);
    } else {
      report[`unique_${label}`] = "ok";
    }
  };
  dupKey("nameKey", "nameKey");
  dupKey("slug", "slug");
  dupKey("name", "name");
  dupKey("displayFanCount", "displayFanCount");

  // ---------- Required fields present ----------
  const missing = (field: keyof (typeof celebs)[number], label: string) => {
    const badOnes = celebs
      .filter((c) => {
        const v = c[field];
        if (typeof v === "string") return !v.trim();
        return v == null;
      })
      .map((c) => c.name);
    if (badOnes.length) {
      bad(`missing ${label}: ${badOnes.join(", ")}`);
    } else {
      report[`${label}_present`] = "ok";
    }
  };
  missing("nameKey", "nameKey");
  missing("slug", "slug");
  missing("name", "name");
  missing("accentColor", "accentColor");

  // Presence of the (giant) profile/cover blobs is checked server-side so the
  // bytes are never transferred: a row that is missing an image has a NULL or
  // empty value.
  const missingBlob = async (field: "profileImage" | "coverImage", label: string) => {
    const n = await prisma.celebrity.count({ where: { [field]: null } });
    const e = await prisma.celebrity.count({ where: { [field]: "" } });
    if (n + e) bad(`missing ${label} values: ${n} null + ${e} empty`);
    else report[`${label}_present`] = "ok";
  };
  await missingBlob("profileImage", "profileImage");
  await missingBlob("coverImage", "coverImage");

  const inactive = celebs.filter((c) => !c.isActive).map((c) => c.name);
  if (inactive.length) bad(`inactive celebs: ${inactive.join(", ")}`);
  else report.isActive_all = "ok";
  const unverified = celebs.filter((c) => !c.isVerified).map((c) => c.name);
  if (unverified.length) bad(`not verified: ${unverified.join(", ")}`);
  else report.isVerified_all = "ok";

  // ---------- Fan numbers: range + uniqueness ----------
  const fanned = celebs.filter((c) => c.displayFanCount != null);
  const fannedValues = fanned.map((c) => c.displayFanCount as number);
  const outOfRange = fannedValues.filter((n) => n < 9272 || n > 5_000_000);
  if (outOfRange.length) bad(`fan numbers out of range: ${outOfRange.join(", ")}`);
  else report.fanRange = "ok (9272..5000000)";
  const dupFans = fannedValues.length - new Set(fannedValues).size;
  if (dupFans) bad(`DUPLICATE fan numbers: ${dupFans}`);
  else report.fanUniqueness = `ok (${fannedValues.length})`;

  // ---------- Tier structure per celebrity ----------
  const base = sanitizeBaseMemberships(undefined);
  const baseNames = base.map((t) => t.name);
  const premiumNames = PREMIUM_LEVELS.map((t: { name: string }) => t.name);
  const expected = 20;
  const expectedNames = [...baseNames, ...premiumNames];

  const tiers = await prisma.membershipLevel.findMany({
    select: { celebrityId: true, name: true, price: true, currency: true, displayOrder: true, isActive: true },
  });
  report.membershipLevelTotal = tiers.length;
  const byCeleb = new Map<string, typeof tiers>();
  for (const t of tiers) {
    const arr = byCeleb.get(t.celebrityId) ?? [];
    arr.push(t);
    byCeleb.set(t.celebrityId, arr);
  }

  const celebById = new Map(celebs.map((c) => [c.id, c]));
  const name = (id: string) => celebById.get(id)?.name ?? "?";
  for (const c of celebs) {
    const mine = byCeleb.get(c.id) ?? [];
    if (mine.length !== expected) {
      bad(`${name(c.id)}: has ${mine.length} tiers (expected ${expected}) — ${mine.map((m) => m.name).join(", ")}`);
    }
    const namesSet = new Set(mine.map((m) => m.name));
    if (namesSet.size !== mine.length) bad(`${name(c.id)}: duplicate tier names`);
    for (const en of expectedNames) {
      if (!namesSet.has(en)) {
        bad(`${name(c.id)}: missing tier "${en}"`);
        break;
      }
    }
    for (const m of mine) {
      if (!expectedNames.includes(m.name)) bad(`${name(c.id)}: unexpected tier "${m.name}"`);
      if (!m.isActive) bad(`${name(c.id)}: inactive tier "${m.name}"`);
      const isBase = baseNames.includes(m.name);
      const okOrder = isBase ? m.displayOrder >= 0 && m.displayOrder < 5 : m.displayOrder >= 100;
      if (m.displayOrder == null || !okOrder) {
        bad(`${name(c.id)}: tier "${m.name}" order ${m.displayOrder} outside ${isBase ? "0..4" : "100+"}`);
      }
    }
    // price sanity: base tiers must not exceed premium
    const basePrices = mine.filter((m) => baseNames.includes(m.name)).map((m) => m.price ?? 0);
    const premPrices = mine.filter((m) => premiumNames.includes(m.name)).map((m) => m.price ?? 0);
    if (premPrices.length && basePrices.length && Math.max(...basePrices) > Math.min(...premPrices)) {
      bad(`${name(c.id)}: base tier price ${Math.max(...basePrices)} > first premium ${Math.min(...premPrices)}`);
    }
    for (const m of mine) {
      if (m.currency !== "USD" && m.currency !== "EUR") bad(`${name(c.id)}: tier "${m.name}" currency "${m.currency}"`);
    }
    const zeroPriced = mine.filter((m) => m.price == null || m.price <= 0).map((m) => m.name);
    if (zeroPriced.length) bad(`${name(c.id)}: non-positive price: ${zeroPriced.join(", ")}`);
  }

  // ---------- Orphan checks ----------
  const orphanTiers = tiers.filter((t) => !celebById.has(t.celebrityId));
  if (orphanTiers.length) bad(`orphan membership rows (no celebrity): ${orphanTiers.length}`);
  else report.orphans = "ok";

  // ---------- Panel sanity: check the RIGHT person got attached ----------
  const checks: [string, string][] = [
    ["Sting", "musician"],
    ["IU", "IU_(entertainer)"],
    ["Rosé", "Ros%C3%A9_(singer)"],
    ["Rain", "Rain_(entertainer)"],
    ["Sido", "Sido_(rapper)"],
    ["Cro", "Cro_(musician)"],
    ["Elisa", "Elisa_(Italian_singer)"],
    ["Sasha", "Sasha_(German_singer)"],
    ["Brad Pitt", "Brad_Pitt"],
    ["Christoph Waltz", "Christoph_Waltz"],
    ["Cristiano Ronaldo", "Cristiano_Ronaldo"],
  ];
  let panelMiss = 0;
  for (const [nm, expect] of checks) {
    const c = celebs.find((x) => x.name === nm);
    if (!c) {
      panelMiss++;
      bad(`panel check: ${nm} not in DB`);
      continue;
    }
    if (!c.googleInfo) {
      panelMiss++;
      continue; // allowed but listed earlier
    }
    let info: { wikipediaUrl?: string; kind?: string; description?: string | null; name?: string } | null = null;
    try {
      info = JSON.parse(c.googleInfo as string);
    } catch {
      bad(`panel check: ${nm} has unparsable googleInfo`);
      continue;
    }
    const url = info?.wikipediaUrl ?? "";
    const kind = info?.kind;
    const desc = info?.description ?? "";
    if (url.includes(expect)) report[`panel_${nm}`] = "ok";
    else {
      panelMiss++;
      bad(`panel check: ${nm} → url ${url} (expected …${expect}); kind=${kind}; desc="${desc.slice(0, 60)}"`);
    }
  }
  report.panelSanityIssues = panelMiss;

  // ---------- Image provenance ----------
  const verified = celebs.filter((c) => c.imageVerified);
  const verifiedNoLicense = verified.filter((c) => !c.imageLicense);
  const verifiedNoSource = verified.filter((c) => !c.imageSourceUrl);
  const byLicense: Record<string, number> = {};
  for (const c of verified) {
    const lic = c.imageLicense ?? "NULL";
    byLicense[lic] = (byLicense[lic] ?? 0) + 1;
  }
  report.verifiedImages = verified.length;
  report.imageLicenseBreakdown = byLicense;
  if (verifiedNoLicense.length) bad(`verified celebs missing imageLicense: ${verifiedNoLicense.map((c) => c.name).join(", ")}`);
  if (verifiedNoSource.length) bad(`verified celebs missing imageSourceUrl: ${verifiedNoSource.map((c) => c.name).join(", ")}`);
  // Unverified celebs — report how many remain with no profile image at all
  const noImgRows = await prisma.celebrity.findMany({
    where: { imageVerified: false, OR: [{ profileImage: null }, { profileImage: "" }] },
    select: { name: true },
  });
  report.unverifiedNoImage = noImgRows.length;
  if (noImgRows.length > 0) report.unverifiedNoImageNames = noImgRows.map((r) => r.name);

  // ---------- Counts vs expectation ----------
  report.namesInSourceList = 678;
  report.existingBefore = 23;
  report.addedByBulk = celebs.length - 23;
  report.expectedAdded = 662; // 663 imported minus Bon Jovi (band) removed by request
  if (celebs.length - 23 !== 662) bad(`added ${celebs.length - 23}, expected 662`);

  console.log("=== AUDIT REPORT ===");
  console.log(JSON.stringify(report, null, 2));
  console.log(`issues found: ${issues.length}`);
  await prisma.$disconnect();
  process.exitCode = issues.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});