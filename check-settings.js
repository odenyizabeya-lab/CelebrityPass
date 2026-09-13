require("dotenv").config({ path: require("node:path").join(process.env.TEMP ?? "C:/Users/HP/AppData/Local/Temp", "opencode", "venv.prod") });
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const s = await p.appSetting.findUnique({ where: { key: "chatAutoReplyGlobalEnabled" } });
  console.log("globalAutoReplySetting:", JSON.stringify(s));
  const c = await p.celebrity.findFirst({ where: { name: { contains: "Johnny" } }, select: { name: true, chatAutoReplyEnabled: true } });
  console.log("celebrity:", JSON.stringify(c));
})().finally(() => p.$disconnect());