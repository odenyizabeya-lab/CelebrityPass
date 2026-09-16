import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url"; import path from "node:path"; import { readFileSync } from "node:fs";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(SCRIPT_DIR, "..", "..");
try { const text = readFileSync(path.join(ROOT, ".env"), "utf8"); for (const line of text.split(/\r?\n/)) { const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line); if (!m || line.trim().startsWith("#")) continue; if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
if (process.env.MIGRATION_DATABASE_URL) process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
const prisma = new PrismaClient({ log: ["error"] });
const LATER = new Set(["donaldtrump","elonmusk","emmanuelmacron","luizinacioluladasilva","javiermilei","claudiasheinbaum","xijinping","vladimirputin","leejamyung","receptayyiperdoan","volodymyrzelenskyy","jeffbezos","billgates","markzuckerberg","larrypage","sergeybrin","larryellison","michaeldell","jensenhuang","warrenbuffett","richardbranson","jackma","mukeshambani","gautamadani","carlosslim","bernardarnault","amancioortega","masayoshison","michaelbloomberg","georgesoros","peterthiel","reedhastings","jackdorsey","brianchesky","philknight","stevewozniak","michaelrubin","raydalio","richardliu","tadashiyanai","shahrukhkhan","robertpattinson","willferrell","jimcarrey","hughgrant","emmawatson","zendaya","ryanreynolds","ryangosling","rihanna","ladygaga","adele","celinedion","justinbieber","theweeknd","drake","shakira","katyperry","pink","edsheeran","britneyspears","christinaaguilera","mileycyrus"]);
(async () => {
  const all = await prisma.celebrity.findMany({ select: { nameKey: true, name: true, googleInfo: true, country: true, bio: true, website: true, instagramUrl: true, facebookUrl: true, tiktokUrl: true, googleUrl: true } });
  for (const c of all) {
    if (LATER.has(c.nameKey)) continue;
    const anyLink = !!(c.googleUrl || c.website || c.instagramUrl || c.facebookUrl || c.tiktokUrl);
    if (!(c.googleInfo && c.country && c.bio && anyLink)) console.log(`${c.name} | country=${c.country ?? "-"} panel=${!!c.googleInfo} bio=${!!c.bio} links=${[c.website,c.instagramUrl,c.facebookUrl,c.tiktokUrl,c.googleUrl].filter(Boolean).length}`);
  }
  await prisma.$disconnect();
})();
