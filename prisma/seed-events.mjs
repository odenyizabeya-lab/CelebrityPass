// Seed: ensure the manual "admin" event source and the keyless/keyed provider
// sources exist. Also disables any leftover sources with no registered
// provider backend (e.g. old "eventbrite").
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const admin = await p.eventSource.findUnique({ where: { key: "admin" } });
if (!admin) {
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

const tm = await p.eventSource.findUnique({ where: { key: "ticketmaster" } });
if (!tm) {
  await p.eventSource.create({
    data: {
      key: "ticketmaster",
      name: "Ticketmaster — official US & Europe concert/show listings",
      kind: "api",
      enabled: true,
      baseUrl: "https://app.ticketmaster.com/discovery/v2",
      envKey: "EVENT_TICKETING_API_KEY",
      hasCredentials: false,
      description:
        "Publicly listed concerts/shows from Ticketmaster's free Discovery API. Add the free API key in Admin → Events → API Keys to start syncing.",
    },
  });
  console.log("Created ticketmaster event source (add a free API key in admin to activate).");
} else {
  console.log("Ticketmaster event source already exists.");
}

// Remove stale sources with no registered provider backend.
const removed = await p.eventSource.updateMany({
  where: { key: { in: ["eventbrite"] } },
  data: { enabled: false },
});
if (removed.count > 0) console.log(`Disabled ${removed.count} stale source(s) with no provider backend.`);

await p.$disconnect();