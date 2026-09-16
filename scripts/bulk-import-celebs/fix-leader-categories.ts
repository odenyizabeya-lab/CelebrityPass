// One-off: fix category for the world-leaders batch. The panel heuristics label
// heads of state and billionaires as Actor/Athlete/Musician from incidental
// Wikidata occupations (e.g. Milei's youth football stint -> "Athlete"). The
// correct top-level bucket on this platform is "Public Figure".
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
const DRY = process.env.BULK_DRY !== "0";

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
const keys = NAMES.map((n) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""));

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });
  const rows = await prisma.celebrity.findMany({ where: { nameKey: { in: keys } }, select: { id: true, name: true, category: true } });
  for (const r of rows) {
    if (r.category === "Public Figure") continue;
    console.log(`${r.name}  ${r.category} -> Public Figure`);
    if (!DRY) await prisma.celebrity.update({ where: { id: r.id }, data: { category: "Public Figure" } });
  }
  console.log(DRY ? "DRY-RUN — set BULK_DRY=0 to apply" : `fixed ${rows.length} categories`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});