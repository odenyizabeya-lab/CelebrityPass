import Link from "next/link";
import AdminTicketSources from "@/components/tickets/AdminTicketSources";
import { prisma } from "@/lib/db";
import { ticketProviders } from "@/lib/ticketing/sources/registry";
import { nextSyncLabel } from "@/lib/ticketing/helpers";
import { SYNC_INTERVAL_MINUTES } from "@/lib/ticketing/types";

export const dynamic = "force-dynamic";

export default async function AdminTicketSourcesPage() {
  const sources = await prisma.eventSource.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { events: true } } },
  });

  const providers = ticketProviders.map((p) => ({
    key: p.key,
    label: p.label,
    requiresCredentials: p.requiresCredentials,
    credentialEnvVars: p.credentialEnvVars,
    hasCredentials: p.credentialEnvVars.some((v) => typeof process.env[v] === "string" && process.env[v]!.length > 0),
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Ticket sources</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Enable ticket sync on a provider-backed source to pull real inventory. The manual “admin” source can never supply tickets.
          </p>
        </div>
        <Link href="/admin/tickets" className="text-sm font-semibold text-zinc-400 transition hover:text-white">← Tickets</Link>
      </div>

      <div className="mt-6">
        <AdminTicketSources
          sources={sources.map((s) => ({
            id: s.id,
            key: s.key,
            name: s.name,
            kind: s.kind,
            enabled: s.enabled,
            supportsTickets: s.supportsTickets,
            hasCredentials: s.hasCredentials,
            ticketsLastSyncStatus: s.ticketsLastSyncStatus,
            ticketsLastSyncMessage: s.ticketsLastSyncMessage,
            nextSync: nextSyncLabel(s.ticketsLastSyncAt, SYNC_INTERVAL_MINUTES),
            eventCount: s._count.events,
          }))}
          providers={providers}
        />
      </div>
    </div>
  );
}