import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: "flutterwave." } },
    select: { key: true, value: true },
  });
  if (rows.length === 0) console.log("NO flutterwave.* settings in DB");
  for (const r of rows) {
    const v = r.value ?? "";
    if (!v) { console.log(`${r.key} = (empty)`); continue; }
    if (v.startsWith("enc1.")) console.log(`${r.key} = enc1.<encrypted-at-rest>`);
    else if (r.key === "flutterwave.enabled" || r.key === "flutterwave.environment") console.log(`${r.key} = ${JSON.stringify(v)}`);
    else if (v.length > 8) console.log(`${r.key} = ${v.slice(0, 4)}…${v.slice(-4)}`);
    else console.log(`${r.key} = ••••`);
  }
  const count = await prisma.payment.count();
  console.log(`\nTotal payments: ${count}`);
  const byStatus = await prisma.payment.groupBy({ by: ["provider", "status"], _count: true });
  for (const g of byStatus) console.log(`  ${g.provider} / ${g.status}: ${g._count}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });