const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } } });
const names = ["Alexander Stubb", "Guy Parmelin", "Tharman Shanmugaratnam", "Isaac Herzog", "Ilham Aliyev", "Volodymyr Zelenskyy", "Prabowo Subianto", "Sergio Mattarella", "Droupadi Murmu", "Mohamed bin Zayed Al Nahyan"];
(async () => {
  await p.$connect();
  const rows = await p.$queryRawUnsafe(
    `SELECT "name", "slug", "category", "isActive" FROM "Celebrity" WHERE "name" ILIKE ANY(ARRAY['Alexander Stubb','Guy Parmelin','Tharman Shanmugaratnam','Isaac Herzog','Ilham Aliyev','Volodymyr Zelenskyy','Prabowo Subianto','Sergio Mattarella','Droupadi Murmu','Mohamed bin Zayed Al Nahyan','%Stubb%','%Parmelin%','%Shanmugaratnam%','%Herzog%','%Aliyev%','%Murmu%','%Subianto%','%Mattarella%']) ORDER BY "name"`
  );
  if (rows.length === 0) console.log("NONE of these exist yet");
  for (const r of rows) console.log(`${r.name} | slug=${r.slug} | cat=${r.category} | active=${r.isActive}`);
  await p.$disconnect();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });