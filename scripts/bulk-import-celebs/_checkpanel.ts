import { PrismaClient } from "@prisma/client";
if (process.env.MIGRATION_DATABASE_URL) process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
if (/pooler\.supabase\.com/i.test(process.env.DATABASE_URL ?? "") && process.env.DIRECT_DATABASE_URL) process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL;
const prisma = new PrismaClient({ log: ["error"] });
(async () => {
  const c = await prisma.celebrity.findUnique({ where: { slug: "lea" }, select: { googleInfo: true } });
  const j = JSON.parse(c?.googleInfo ?? "{}");
  console.log("wikipediaUrl:", j.wikipediaUrl ?? "MISSING");
  console.log("keys:", Object.keys(j).join(", "));
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exitCode = 1; });
