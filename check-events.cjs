const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const sources = await p.eventSource.findMany({ select: { key: true, enabled: true, lastSyncStatus: true } });
  console.log('=== EventSources ===');
  console.log(JSON.stringify(sources, null, 2));

  const events = await p.celebrityEvent.findMany({
    include: { celebrity: { select: { name: true } }, ticketInventory: true },
  });
  console.log('=== CelebrityEvents count:', events.length, '===');
  for (const ev of events) {
    console.log(JSON.stringify({
      name: ev.name,
      celeb: ev.celebrity?.name,
      startAt: ev.startAt,
      city: ev.city,
      country: ev.country,
      ticketInventory: ev.ticketInventory.map(t => ({ name: t.name, price: t.priceArea, status: t.status })),
    }));
  }

  const invCount = await p.ticketInventory.count();
  console.log('=== TicketInventory rows:', invCount, '===');

  await p.$disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
