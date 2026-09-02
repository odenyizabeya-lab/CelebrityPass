// Event service: query layer used by public pages and admin. Always serves
// from the database (never calls external sources on render). Live status is
// derived on read so it's always current without a background job.
import { prisma } from "@/lib/db";
import { computeEventStatus } from "./helpers";
import type { ComputedEventStatus } from "./helpers";

export type EventSummary = {
  id: string;
  eventId: string;
  celebrityId: string;
  celebritySlug: string;
  celebrityName: string;
  name: string;
  type: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  startAt: Date;
  endAt: Date | null;
  timezone: string | null;
  allDay: boolean;
  status: ComputedEventStatus;
  officialUrl: string | null;
  ticketUrl: string | null;
  sourceUrl: string | null;
  verification: string;
  lastSyncedAt: Date | null;
  updatedAt: Date;
  /** True when a connected ticket source reports sellable inventory for this event. */
  ticketsAvailable?: boolean;
};

type EventRow = {
  id: string;
  eventId: string;
  celebrityId: string;
  celebrity: { slug: string; name: string };
  name: string;
  type: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  startAt: Date;
  endAt: Date | null;
  timezone: string | null;
  allDay: boolean;
  statusOverride: string | null;
  officialUrl: string | null;
  ticketUrl: string | null;
  sourceUrl: string | null;
  verification: string;
  lastSyncedAt: Date | null;
  updatedAt: Date;
};

function toSummary(row: EventRow): EventSummary {
  const status = computeEventStatus({
    statusOverride: row.statusOverride,
    startAt: row.startAt,
    endAt: row.endAt,
    allDay: row.allDay,
  });
  return {
    id: row.id,
    eventId: row.eventId,
    celebrityId: row.celebrityId,
    celebritySlug: row.celebrity.slug,
    celebrityName: row.celebrity.name,
    name: row.name,
    type: row.type,
    description: row.description,
    venue: row.venue,
    city: row.city,
    region: row.region,
    country: row.country,
    startAt: row.startAt,
    endAt: row.endAt,
    timezone: row.timezone,
    allDay: row.allDay,
    status,
    officialUrl: row.officialUrl,
    ticketUrl: row.ticketUrl,
    sourceUrl: row.sourceUrl,
    verification: row.verification,
    lastSyncedAt: row.lastSyncedAt,
    updatedAt: row.updatedAt,
  };
}

const includeCeleb = { select: { slug: true, name: true } } as const;

/** Events for a single celebrity, split into live sections (for profile page). */
export async function getCelebrityEvents(celebrityId: string) {
  const rows = await prisma.celebrityEvent.findMany({
    where: { celebrityId },
    include: { celebrity: includeCeleb },
    orderBy: [{ startAt: "asc" }],
  });
  const mapped = rows.map(toSummary);
  if (mapped.length > 0) {
    const inventoryRows = await prisma.ticketInventory.findMany({
      where: {
        status: { in: ["AVAILABLE", "LIMITED"] },
        OR: [{ quantityAvailable: null }, { quantityAvailable: { gt: 0 } }],
        eventId: { in: mapped.map((e) => e.id) },
      },
      select: { eventId: true },
    });
    const sellableIds = new Set(inventoryRows.map((r) => r.eventId));
    for (const e of mapped) e.ticketsAvailable = sellableIds.has(e.id);
  }
  const upcoming = mapped.filter((e) => e.status === "UPCOMING");
  const happening = mapped.filter((e) => e.status === "HAPPENING_NOW");
  const completed = mapped.filter((e) => e.status === "COMPLETED").sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  const postponed = mapped.filter((e) => e.status === "POSTPONED");
  const cancelled = mapped.filter((e) => e.status === "CANCELLED");
  return { all: mapped, upcoming, happening, completed, postponed, cancelled };
}

export async function getEventById(eventId: string): Promise<EventSummary | null> {
  const row = await prisma.celebrityEvent.findUnique({
    where: { eventId },
    include: { celebrity: includeCeleb },
  });
  if (!row) return null;
  return toSummary(row as EventRow);
}

export type AdminEventFilters = {
  search?: string | null;
  celebrityId?: string | null;
  type?: string | null;
  country?: string | null;
  status?: string | null;
  verification?: string | null;
};

/** Admin list with optional filters. */
export async function getAdminEvents(filters: AdminEventFilters = {}) {
  const where: Record<string, unknown> = {};

  if (filters.celebrityId) where.celebrityId = filters.celebrityId;
  if (filters.type) where.type = filters.type;
  if (filters.country) where.country = filters.country;
  if (filters.verification) where.verification = filters.verification;

  // Status filter must be applied AFTER deriving live status, so we fetch and
  // filter in JS for any status query; otherwise push status onto where as a
  // base when not the derived statuses (but those are most common).
  const rows = await prisma.celebrityEvent.findMany({
    where,
    include: { celebrity: includeCeleb },
    orderBy: [{ startAt: "desc" }],
    take: 500,
  });

  const mapped = rows.map(toSummary);

  const q = filters.search?.trim().toLowerCase();
  let filtered = q
    ? mapped.filter((e) =>
        [e.name, e.venue, e.city, e.country, e.celebrityName, e.type].filter(Boolean).some((f) =>
          String(f).toLowerCase().includes(q),
        ),
      )
    : mapped;

  if (filters.status) {
    filtered = filtered.filter((e) => e.status === filters.status);
  }

  return filtered;
}

export async function getEventSources() {
  return prisma.eventSource.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { events: true } } },
  });
}
