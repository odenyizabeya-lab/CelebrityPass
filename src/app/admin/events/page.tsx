import AdminEventsManager from "@/components/admin/events/AdminEventsManager";
import { prisma } from "@/lib/db";
import { EVENT_TYPES, EVENT_STATUSES, VERIFICATION_STATUSES } from "@/lib/events/types";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const celebrities = await prisma.celebrity.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  const sources = await prisma.eventSource.findMany({ select: { id: true, key: true, name: true, lastSyncAt: true, lastSyncStatus: true } });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Public Events</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage publicly announced celebrity events and their sync sources.</p>
        </div>
      </div>
      <div className="mt-6">
        <AdminEventsManager
          celebrities={celebrities as { id: string; name: string; slug: string }[]}
          sources={sources.map((s) => ({ ...s, lastSyncAt: s.lastSyncAt ? s.lastSyncAt.toISOString() : null })) as unknown as {
            id: string;
            key: string;
            name: string;
            lastSyncAt: string | null;
            lastSyncStatus: string | null;
          }[]}
          eventTypes={EVENT_TYPES as unknown as string[]}
          statuses={EVENT_STATUSES as unknown as string[]}
          verifications={VERIFICATION_STATUSES as unknown as string[]}
        />
      </div>
    </div>
  );
}
