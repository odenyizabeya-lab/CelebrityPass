const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } } });
(async () => {
  await p.$connect();
  const rows = await p.$queryRawUnsafe(
    `SELECT "name", "slug", "googleInfo" FROM "Celebrity" WHERE "name" IN ('Donald Trump','Emmanuel Macron','Luiz Inácio Lula da Silva','Javier Milei','Claudia Sheinbaum','Xi Jinping','Vladimir Putin','Lee Jae-myung','Recep Tayyip Erdoğan','Volodymyr Zelenskyy')`
  );
  for (const r of rows) {
    let g = null;
    try { g = r.googleInfo ? JSON.parse(r.googleInfo) : null; } catch {}
    const occ = g?.occupations?.slice(0, 4) ?? [];
    const desc = g?.description ?? "";
    const kind = g?.kind ?? "";
    console.log(`${r.name} => kind=${kind} | occ=[${occ.join(", ")}] | desc="${desc}"`);
  }
  await p.$disconnect();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });