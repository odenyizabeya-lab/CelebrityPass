import "dotenv/config";
import { join } from "node:path";
import { config } from "dotenv";
config({ path: join(process.env.TEMP ?? "C:/Users/HP/AppData/Local/Temp", "opencode", "venv.prod"), override: true });

import { composeAutoReply } from "./src/lib/ai/assistant";
import { loadAiMemory } from "./src/lib/ai/memory";
import { prisma } from "./src/lib/db";
import { execSync } from "node:child_process";

(async () => {
  const convId = process.argv[2] || "cmtyb0hyb0001jp04t6imwzjb";
  console.log("conv:", convId);
  const mem = await loadAiMemory(convId);
  console.log("MEMORY NOW:", JSON.stringify(mem) || "(empty)");

  const msgs = await prisma.chatMessage.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { senderType: true, body: true, createdAt: true },
  });
  for (const m of msgs.reverse()) console.log(`  [${m.senderType}] ${String(m.body).slice(0, 80)}`);

  const t0 = Date.now();
  const result = await composeAutoReply(convId);
  console.log("\ncompose took", ((Date.now() - t0) / 1000).toFixed(1) + "s");
  console.log("configured:", result.configured);
  console.log("TEXT >>>", result.text);
})().finally(() => prisma.$disconnect());