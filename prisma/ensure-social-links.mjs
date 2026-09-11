// One-time data repair for the four permanent platform links.
//   - google: every celebrity gets the deterministic Google official-result
//     search page for their exact name (the scanner's own fallback rule).
//   - facebook/instagram/tiktok: keeps only real official-profile URLs; any
//     junk, placeholder, or non-platform value is removed (nothing renders
//     that cannot be real). Mirrors src/lib/social/resolve.ts.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLATFORM_HOSTS = { facebook: "facebook.com", instagram: "instagram.com", tiktok: "tiktok.com" };

function isDomain(hostname, base) {
  const h = String(hostname).toLowerCase().replace(/^www\./, "");
  return h === base || h.endsWith(`.${base}`);
}

function normalizeUrl(platform, raw) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol)) return null;
  if (platform === "google") {
    return isDomain(url.hostname, "google.com") && !String(url.hostname).includes("googleusercontent.com")
      ? trimmed
      : null;
  }
  const host = PLATFORM_HOSTS[platform];
  if (!isDomain(url.hostname, host)) return null;
  const path = url.pathname.replace(/\/+$/, "");
  if (!path || path === "/search" || path === "/share" || path.startsWith("/hashtag")) return null;
  if (/@?(undefined|null|none|noname|user|profile)\b/i.test(path)) return null;
  if (/%7[bB]|%7[dD]|\{[^}]*\}/.test(trimmed)) return null;
  return trimmed;
}

function defaultGoogleUrl(name) {
  const q = String(name ?? "").trim();
  return q ? `https://www.google.com/search?q=${encodeURIComponent(q)}` : null;
}

const rows = await prisma.celebrity.findMany({
  select: { id: true, slug: true, name: true, facebookUrl: true, instagramUrl: true, tiktokUrl: true, googleUrl: true },
});

const report = { total: rows.length, googleFilled: 0, googleReplaced: 0, toNull: 0, kept: 0 };
const changed = [];

for (const row of rows) {
  const patches = {};
  const fb = normalizeUrl("facebook", row.facebookUrl);
  const ig = normalizeUrl("instagram", row.instagramUrl);
  const tt = normalizeUrl("tiktok", row.tiktokUrl);
  const gg = normalizeUrl("google", row.googleUrl) ?? defaultGoogleUrl(row.name);

  if (fb !== (row.facebookUrl ?? null)) {
    patches.facebookUrl = fb;
    if (fb) report.kept++; else report.toNull++;
  }
  if (ig !== (row.instagramUrl ?? null)) {
    patches.instagramUrl = ig;
    if (ig) report.kept++; else report.toNull++;
  }
  if (tt !== (row.tiktokUrl ?? null)) {
    patches.tiktokUrl = tt;
    if (tt) report.kept++; else report.toNull++;
  }
  if (gg !== (row.googleUrl ?? null)) {
    patches.googleUrl = gg;
    if (row.googleUrl && gg) report.googleReplaced++; else report.googleFilled++;
  }

  if (Object.keys(patches).length > 0) {
    changed.push({ slug: row.slug, ...patches });
    await prisma.celebrity.update({ where: { id: row.id }, data: patches });
  }
}

console.log(JSON.stringify(report, null, 2));
console.log("CHANGED:", JSON.stringify(changed, null, 2));
await prisma.$disconnect();