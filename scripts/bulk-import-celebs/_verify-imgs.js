const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } } });
const slugs = ["bongbong-marcos","droupadi-murmu","alexander-stubb","cyril-ramaphosa","guy-parmelin"];
(async () => {
  await p.$connect();
  for (const s of slugs) {
    const r = await p.$queryRawUnsafe(`SELECT slug, name, "imageVerified", "imageStatus", LEFT(COALESCE("profileImage",'') , 40) AS img64, LENGTH(COALESCE("profileImage",'')) AS len FROM "Celebrity" WHERE slug = $1`, s);
    const row = r[0];
    console.log(`${row.slug} | verified=${row.imageVerified} | status=${row.imageStatus} | imglen=${row.len} | head=${row.img64}`);
  }
  await p.$disconnect();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });