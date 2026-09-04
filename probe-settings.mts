import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
(async () => {
  await p.appSetting.deleteMany({ where: { key: "admin.password_hash" } });
  const left = await p.appSetting.count({ where: { key: "admin.password_hash" } });
  console.log("cleared. remaining hash rows:", left);
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});