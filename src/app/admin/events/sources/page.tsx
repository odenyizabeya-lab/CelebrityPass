import EventSourcesManager from "@/components/admin/events/EventSourcesManager";
import ProviderKeyManager from "@/components/admin/events/ProviderKeyManager";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminEventSourcesPage() {
  const rows = await prisma.eventSource.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { events: true } } },
  });
  const sources = rows.map((s) => ({
    ...s,
    lastSyncAt: s.lastSyncAt ? s.lastSyncAt.toISOString() : null,
    hasCredentials: Boolean(s.hasCredentials),
  }));

  return (
    <div>
      <div>
        <h1 className="text-2xl font-black tracking-tight">Event Sources</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Connect legitimate public event data sources. Credentials are always read from backend settings — never stored
          in the frontend and never sent to the browser.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-6">
        <ProviderKeyManager />
        <EventSourcesManager sources={sources} />
      </div>
    </div>
  );
}
