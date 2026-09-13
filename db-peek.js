require("dotenv").config({ path: require("node:path").join(process.env.TEMP ?? "C:/Users/HP/AppData/Local/Temp", "opencode", "venv.prod") });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const conv = await prisma.chatConversation.findUnique({
    where: { id: process.argv[2] || "cmtyb0hyb0001jp04t6imwzjb" },
    select: { id: true, aiMemory: true, lastMessagePreview: true, lastMessageAt: true, lastMessageSender: true, status: true },
  });
  console.log("=== ChatConversation row ===");
  console.log(JSON.stringify(conv, null, 2));
  const msgs = await prisma.chatMessage.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  console.log("=== last messages (full text, newest first) ===");
  for (const m of msgs.reverse()) console.log(`[${m.senderType}] ${m.body}`);
})().finally(() => prisma.$disconnect());