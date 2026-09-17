const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } } });
(async () => {
  await p.$connect();
  const rows = await p.$queryRawUnsafe(
    `SELECT "name", "slug", "googleInfo" FROM "Celebrity" WHERE "category" = 'Public Figure'`
  );
  const leaders = [];
  for (const r of rows) {
    let g = null;
    try { g = r.googleInfo ? JSON.parse(r.googleInfo) : null; } catch {}
    const desc = (g?.description ?? "").toLowerCase();
    if (desc.includes("president of") || desc.includes("president of") || desc.includes("leader of") || desc.includes("prime minister of") || desc.includes("chancellor of")) {
      leaders.push(`${r.name} (${r.slug}) — ${g?.description}`);
    }
  }
  console.log(`Total Public Figure: ${rows.length}`);
  console.log(`Presidents/leaders: ${leaders.length}`);
  for (const l of leaders) console.log(" -", l);
  await p.$disconnect();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });