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

const NAMES = [
  "Donald Trump", "Elon Musk", "Emmanuel Macron", "Luiz Inácio Lula da Silva", "Javier Milei",
  "Claudia Sheinbaum", "Xi Jinping", "Vladimir Putin", "Lee Jae-myung", "Recep Tayyip Erdoğan",
  "Volodymyr Zelenskyy", "Jeff Bezos", "Bill Gates", "Mark Zuckerberg", "Larry Page",
  "Sergey Brin", "Larry Ellison", "Michael Dell", "Jensen Huang", "Warren Buffett",
  "Richard Branson", "Jack Ma", "Mukesh Ambani", "Gautam Adani", "Carlos Slim",
  "Bernard Arnault", "Amancio Ortega", "Masayoshi Son", "Michael Bloomberg", "George Soros",
  "Peter Thiel", "Reed Hastings", "Jack Dorsey", "Brian Chesky", "Phil Knight",
  "Steve Wozniak", "Michael Rubin", "Ray Dalio", "Richard Liu", "Tadashi Yanai",
];
const isReal = (u: string | null) => !!u && /^data:image\/(jpeg|png|webp);/i.test(u);

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });
  const celebs = await prisma.celebrity.findMany({
    where: { nameKey: { in: NAMES.map((n) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")) } },
    select: {
      slug: true, name: true, nameKey: true, category: true, country: true, profession: true, bio: true,
      googleInfo: true, profileImage: true, imageSource: true, imageVerified: true,
      website: true, instagramUrl: true, facebookUrl: true, tiktokUrl: true, googleUrl: true,
      displayFanCount: true, isActive: true,
      memberships: { select: { name: true, price: true, isActive: true }, orderBy: { displayOrder: "asc" } },
    },
  });
  console.log(`matched ${celebs.length}/${NAMES.length}`);
  let bad = 0;
  for (const c of celebs) {
    const panel = !!(c.googleInfo && JSON.parse(c.googleInfo as string)?.overview);
    const tierNames = c.memberships.map((m) => m.name).join(",");
    const ok = c.country && c.bio && panel && isReal(c.profileImage) && c.displayFanCount != null && tierNames.includes("Silver") && tierNames.includes("Gold");
    if (!ok) bad++;
    console.log(
      `${c.name.padEnd(22)} | ${String(c.category).padEnd(13)} | ${String(c.country).padEnd(19)} | img=${isReal(c.profileImage) ? "Y" : "N"}(${c.imageSource ?? "-"}) | panel=${panel ? "Y" : "N"} | bio=${c.bio ? "Y" : "N"} | links=${[c.website, c.instagramUrl, c.facebookUrl, c.tiktokUrl, c.googleUrl].filter(Boolean).length}/5 | fans=${c.displayFanCount ?? "-"} | tiers=[${tierNames}] | active=${c.isActive ? "Y" : "N"} | /celebrity/${c.slug}`,
    );
  }
  console.log(`\nincomplete profiles: ${bad}/${celebs.length}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});