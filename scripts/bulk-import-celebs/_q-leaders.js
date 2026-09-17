const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } } });
(async () => {
  await p.$connect();
  const rows = await p.$queryRawUnsafe(
    `SELECT "name", "slug", "category", "profession", "country", "isFeatured" FROM "Celebrity" WHERE "name" IN ('Donald Trump','Emmanuel Macron','Luiz Inácio Lula da Silva','Javier Milei','Claudia Sheinbaum','Xi Jinping','Vladimir Putin','Lee Jae-myung','Recep Tayyip Erdoğan','Volodymyr Zelenskyy') ORDER BY "name"`
  );
  const all = await p.$queryRawUnsafe(
    `SELECT DISTINCT "profession" FROM "Celebrity" WHERE "profession" ILIKE '%president%' OR "profession" ILIKE '%leador%' OR "profession" ILIKE '%politician%' OR "profession" ILIKE '%prime minister%' OR "profession" ILIKE '%chancellor%' ORDER BY "profession"`
  );
  console.log("== elected/appointed heads-of-state sample ==");
  for (const r of rows) console.log(`${r.name} | cat=${r.category} | prof=${r.profession} | ctry=${r.country} | fea=${r.isFeatured}`);
  console.log("\n== distinct professions matching leader keywords ==");
  for (const r of all) console.log("-", r.profession);
  await p.$disconnect();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });