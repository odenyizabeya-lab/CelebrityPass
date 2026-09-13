require("dotenv").config({ path: require("node:path").join(process.env.TEMP ?? "C:/Users/HP/AppData/Local/Temp", "opencode", "venv.prod") });
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
const convId = "cmtyb0hyb0001jp04t6imwzjb";
async function once() {
  const msgs = await p.chatMessage.findMany({ where: { conversationId: convId }, orderBy: { createdAt: "desc" }, take: 5 });
  for (const m of msgs.reverse()) console.log(`[${m.senderType}] ${String(m.body).slice(0, 220)}`);
  console.log("---");
}
(async () => {
  for (let i = 0; i < 12; i++) {
    try { await once(); console.log("DB OK"); return; }
    catch (e) { console.log(`try ${i + 1}: pooler down (${e.message.slice(0, 50)})`); await new Promise((r) => setTimeout(r, 15000)); }
  }
  throw new Error("pooler never recovered");
})().finally(() => p.$disconnect());