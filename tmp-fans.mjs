import fs from "fs";
const envPath = process.cwd() + "/.env";
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const fans = await prisma.fan.findMany({ select: { id: true, name: true, email: true, isActive: true, createdAt: true } });
console.log("fans:", fans.length);
for (const f of fans) console.log(JSON.stringify(f));
await prisma.$disconnect();