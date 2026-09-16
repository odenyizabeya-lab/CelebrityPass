// Measure completeness gaps across the original 685 batch.
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

const LATER = new Set<string>([
  "donaldtrump","elonmusk","emmanuelmacron","luizinacioluladasilva","javiermilei","claudiasheinbaum","xijinping","vladimirputin","leejamyung","receptayyiperdoan","volodymyrzelenskyy","jeffbezos","billgates","markzuckerberg","larrypage","sergeybrin","larryellison","michaeldell","jensenhuang","warrenbuffett","richardbranson","jackma","mukeshambani","gautamadani","carlosslim","bernardarnault","amancioortega","masayoshison","michaelbloomberg","georgesoros","peterthiel","reedhastings","jackdorsey","brianchesky","philknight","stevewozniak","michaelrubin","raydalio","richardliu","tadashiyanai",
  "shahrukhkhan","robertpattinson","willferrell","jimcarrey","hughgrant","emmawatson","zendaya","ryanreynolds","ryangosling","rihanna","ladygaga","adele","celinedion","justinbieber","theweeknd","drake","shakira","katyperry","pink","edsheeran","britneyspears","christinaaguilera","mileycyrus",
]);

let mCountry = 0, mPanel = 0, mBio = 0, mGurl = 0, mAllLinks = 0, mNothing = 0, complete = 0;

async function main() {
  const all = await prisma.celebrity.findMany({ select: { nameKey: true, name: true, googleInfo: true, country: true, bio: true, website: true, instagramUrl: true, facebookUrl: true, tiktokUrl: true, googleUrl: true } });
  let origCount = 0;
  for (const c of all) {
    if (LATER.has(c.nameKey)) continue;
    origCount++;
    if (!c.country) mCountry++;
    if (!c.googleInfo) mPanel++;
    if (!c.bio) mBio++;
    if (!c.googleUrl) mGurl++;
    const anyLink = !!(c.googleUrl || c.website || c.instagramUrl || c.facebookUrl || c.tiktokUrl);
    if (!c.website && !c.instagramUrl && !c.facebookUrl && !c.tiktokUrl) mAllLinks++;
    if (!anyLink) mNothing++;
    if (c.googleInfo && c.country && c.bio && anyLink) complete++;
  }
  console.log(`originals: ${origCount}`);
  console.log(`missing country: ${mCountry}`);
  console.log(`missing googleInfo(panel): ${mPanel}`);
  console.log(`missing bio: ${mBio}`);
  console.log(`missing googleUrl: ${mGurl}`);
  console.log(`missing all socials+website: ${mAllLinks}`);
  console.log(`missing googleUrl & website & socials: ${mNothing}`);
  console.log(`COMPLETE (panel+country+bio+anyLink): ${complete}`);
  console.log(`NEEDS WORK: ${origCount - complete}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});