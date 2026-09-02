// Seed: ensure the "admin" manual event source exists.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const existing = await p.eventSource.findUnique({ where: { key: "admin" } });
if (!existing) {
  await p.eventSource.create({
    data: {
      key: "admin",
      name: "Admin-added public events",
      kind: "manual",
      enabled: true,
      description: "Public events entered directly by an administrator.",
    },
  });
  console.log("Created admin event source.");
} else {
  console.log("Admin event source already exists.");
}
await p.$disconnect();