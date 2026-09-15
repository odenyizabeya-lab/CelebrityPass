// SAFE removal of a celebrity community (deletes memberships, fan cards,
// followers, chat, events etc. via DB cascade). Always prints the full
// identity before deleting and refuses to run without TARGET_SLUG.
// Run: npx tsx scripts/bulk-import-celebs/delete-celeb.ts   (env TARGET_SLUG=bon-jovi)
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

const when = String(process.env.TARGET_SLUG ?? "").trim().toLowerCase();

async function main() {
  const { prisma } = await import("@/lib/db");
  const target = when
    ? await prisma.celebrity.findUnique({ where: { slug: when } })
    : null;
  if (!target) {
    console.error(`no celebrity with slug "${when}" (TARGET_SLUG required) — nothing deleted`);
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }
  let desc = "";
  try {
    const j = JSON.parse(target.googleInfo ?? "");
    desc = String(j.description ?? "");
  } catch {}
  const [memberships, followers, fanCards] = await Promise.all([
    prisma.membershipLevel.count({ where: { celebrityId: target.id } }),
    prisma.fanCelebritySelection.count({ where: { celebrityId: target.id } }),
    prisma.fanCard.count({ where: { celebrityId: target.id } }),
  ]);
  console.log("=== IDENTITY (verify this is the right one) ===");
  console.log(
    JSON.stringify({
      name: target.name,
      slug: target.slug,
      category: target.category,
      createdAt: target.createdAt,
      fanNumber: target.displayFanCount,
      description: desc.slice(0, 160),
      memberships,
      followers,
      fanCards,
    }),
  );
  if (process.env.CONFIRM !== "YES") {
    console.error("aborted — set CONFIRM=YES to delete");
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }
  await prisma.celebrity.delete({ where: { id: target.id } });
  const remaining = await prisma.celebrity.count();
  console.log(`deleted "${target.name}" (${target.slug}). remaining celebrities: ${remaining}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});