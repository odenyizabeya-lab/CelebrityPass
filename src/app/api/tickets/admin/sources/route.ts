import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ticketProviders } from "@/lib/ticketing/sources/registry";
import { nextSyncLabel } from "@/lib/ticketing/helpers";
import { SYNC_INTERVAL_MINUTES } from "@/lib/ticketing/types";

export const dynamic = "force-dynamic";

// GET /api/tickets/admin/sources — sources + ticket-capability + sync state.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  return NextResponse.json({
    sources: sources.map((s) => ({
      id: s.id,
      key: s.key,
      name: s.name,
      kind: s.kind,
      enabled: s.enabled,
      supportsTickets: s.supportsTickets,
      hasCredentials: s.hasCredentials,
      ticketsLastSyncAt: s.ticketsLastSyncAt,
      ticketsLastSyncStatus: s.ticketsLastSyncStatus,
      ticketsLastSyncMessage: s.ticketsLastSyncMessage,
      nextSync: nextSyncLabel(s.ticketsLastSyncAt, SYNC_INTERVAL_MINUTES),
      eventCount: s._count.events,
    })),
    providers,
  });
}