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

const tables = ["Celebrity", "FanCard", "EventRegistration", "TicketOrder", "Fan"];
for (const t of tables) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "${t}" WHERE CAST(row_to_json("${t}")::text AS text) ILIKE '%linda%' LIMIT 5`
    );
    if (rows.length) { console.log(`${t}: ` + rows.length + " row(s)"); console.log(JSON.stringify(rows, null, 1)); }
  } catch (e) {
    console.log(`${t}: query failed (${String(e.message).slice(0, 80)})`);
  }
}
await prisma.$disconnect();