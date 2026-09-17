const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } } });
const slugs = ["alexander-stubb","guy-parmelin","tharman-shanmugaratnam","isaac-herzog","ilham-aliyev","prabowo-subianto","sergio-mattarella","droupadi-murmu","mohamed-bin-zayed-al-nahyan","nicuor-dan","marcelo-rebelo-de-sousa","petr-pavel","gitanas-nausda","nataa-pirc-musar","frank-walter-steinmeier","aleksandar-vui","asif-ali-zardari","catherine-connolly","karol-nawrocki","maia-sandu","alexander-van-der-bellen","gordana-siljanovska-davkova","cyril-ramaphosa","jakov-milatovi","bongbong-marcos","santiago-pea"];
(async () => {
  await p.$connect();
  const rows = await p.$queryRawUnsafe(`SELECT id, slug, name, category, "googleInfo" FROM "Celebrity" WHERE slug = ANY($1)`, slugs);
  for (const r of rows) {
    let g = null; try { g = r.googleInfo ? JSON.parse(r.googleInfo) : null; } catch {}
    const desc = g?.description ?? "";
    const leader = /(^|\b)(president|chairman)\s+of\b|\bpresident\s+since\b|\bleader\s+of\b|prime\s+minister\s+of\b|chancellor\s+of\b/i.test(desc);
    if (r.category !== "Public Figure") {
      await p.$executeRawUnsafe(`UPDATE "Celebrity" SET "category" = 'Public Figure' WHERE slug = $1`, r.slug);
      r.category = "Public Figure";
    }
    console.log(`${leader ? "LEADER " : "NOT-LEADER"} | ${r.name} | cat=${r.category} | ${desc}`);
  }
  await p.$disconnect();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });