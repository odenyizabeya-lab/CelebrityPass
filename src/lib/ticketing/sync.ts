// Ticket synchronization engine.
//
// Polls enabled ticket providers in the background and reconciles ticket
// inventory + event-status news into the local database. It NEVER fabricates:
//   * inventory rows are only created/updated from provider payloads
//   * sold-out / cancelled / postponed / rescheduled only from the source
//   * "last sync" meta is only set when a sync actually ran
//
// Visitors are only ever served from the DB — providers are never called on
// page render.
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeEventStatus } from "@/lib/events/helpers";
import { getTicketProviderByKeyOrDefault } from "./sources/registry";
import { ProviderError } from "./sources/types";
import type { TicketSyncPayload, TicketInventoryRecord } from "./sources/types";

export type TicketSyncResult = {
  sourceId: string;
  providerKey: string | null;
  ok: boolean;
  events: number;
  inventoryNew: number;
  inventoryUpdated: number;
  cancelled: number;
  rescheduled: number;
  message?: string;
  startedAt: string;
  finishedAt: string;
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseJson(v: string | null, fallback: Record<string, unknown>): Record<string, unknown> {
  if (!v) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function collectCredentials(envVars: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const v of envVars) {
    const val = process.env[v];
    if (val) out[v.toLowerCase().replace(/^.*?_(api_key|key|token|secret)$/, "$1")] = val;
  }
  const direct = process.env.EVENT_TICKETING_API_KEY;
  if (direct) out.apiKey = direct;
  return out;
}

async function mark(source: { id: string }, status: string, message: string | null) {
  await prisma.eventSource
    .update({
      where: { id: source.id },
      data: { ticketsLastSyncStatus: status, ticketsLastSyncMessage: message, ticketsLastSyncAt: new Date() },
    })
    .catch(() => undefined);
}

export async function runTicketSourceSync(sourceId: string): Promise<TicketSyncResult> {
  const startedAt = new Date().toISOString();
  const source = await prisma.eventSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Source not found");
  if (!source.enabled || source.key === "admin") {
    return { sourceId, providerKey: source.key, ok: true, events: 0, inventoryNew: 0, inventoryUpdated: 0, cancelled: 0, rescheduled: 0, message: "Skipped (not a ticket source).", startedAt, finishedAt: new Date().toISOString() };
  }

  const provider = getTicketProviderByKeyOrDefault(source.key);

  // No registered provider backend for this source yet → honest notice.
  if (!provider) {
    await mark(source, "error", "No registered ticket provider for this source key.");
    return { sourceId, providerKey: source.key, ok: false, events: 0, inventoryNew: 0, inventoryUpdated: 0, cancelled: 0, rescheduled: 0, message: "No registered ticket provider for this source key.", startedAt, finishedAt: new Date().toISOString() };
  }
  if (!source.supportsTickets) {
    await mark(source, "idle", "Ticket sync is not enabled for this source (enable it in admin).");
    return { sourceId, providerKey: provider.key, ok: true, events: 0, inventoryNew: 0, inventoryUpdated: 0, cancelled: 0, rescheduled: 0, message: "Ticket sync not enabled.", startedAt, finishedAt: new Date().toISOString() };
  }

  await mark(source, "running", null);

  try {
    const { payloads, message } = await provider.fetchTicketData({
      prisma: prisma as PrismaClient,
      options: {
        config: parseJson(source.configJson, {}),
        credentials: collectCredentials(provider.credentialEnvVars),
      },
    });

    const stats = { events: 0, inventoryNew: 0, inventoryUpdated: 0, cancelled: 0, rescheduled: 0 };

    for (const payload of payloads) {
      const eventRow = await matchEvent(source.id, payload);
      if (!eventRow) continue; // no reliable match → skip, never guess

      stats.events += 1;
      const affected = await applyEventNews(eventRow, payload, source.key);
      stats.cancelled += affected.cancelled;
      stats.rescheduled += affected.rescheduled;

      if (payload.statusOverride === "CANCELLED") {
        await prisma.ticketInventory.updateMany({
          where: { eventId: eventRow.id, sourceId: source.id },
          data: { status: "UNAVAILABLE", updatedAt: new Date() },
        }).catch(() => undefined);
      }

      for (const rec of payload.inventory) {
        const res = await upsertInventory(eventRow.id, sourceId, rec);
        if (res.created) stats.inventoryNew += 1;
        if (res.updated) stats.inventoryUpdated += 1;
      }
    }

    // Recompute live status for past events (same rule as event sync).
    await recomputePastStatuses();

    const doneMessage = message ?? `Synced ${payloads.length} event payload(s).`;
    await mark(source, "ok", doneMessage);
    return { ...stats, sourceId, providerKey: provider.key, ok: true, message: doneMessage, startedAt, finishedAt: new Date().toISOString() };
  } catch (e) {
    const msg = e instanceof ProviderError ? e.message : e instanceof Error ? e.message : String(e);
    await mark(source, "error", msg);
    return { sourceId, providerKey: provider.key, ok: false, events: 0, inventoryNew: 0, inventoryUpdated: 0, cancelled: 0, rescheduled: 0, message: msg, startedAt, finishedAt: new Date().toISOString() };
  }
}

/** Run ticket sync for every enabled, ticket-capable source. */
export async function runAllTicketSyncs() {
  const sources = await prisma.eventSource.findMany({
    where: { enabled: true, key: { not: "admin" }, supportsTickets: true },
    select: { id: true },
  });
  const results = [];
  for (const s of sources) {
    results.push(await runTicketSourceSync(s.id));
  }
  return results;
}

type MatchedEvent = { id: string; eventId: string };

async function matchEvent(sourceId: string, payload: TicketSyncPayload): Promise<MatchedEvent | null> {
  // Preferred: provider's own event id on this source's link.
  if (payload.eventExternalId) {
    const link = await prisma.eventSourceLink.findFirst({
      where: { sourceId, externalId: payload.eventExternalId },
      select: { eventId: true },
    });
    if (link) return { id: link.eventId, eventId: link.eventId };
  }
  // Fallback: exact normalized name + startAt (already celebrity-match-safe).
  if (payload.startAt) {
    const start = new Date(payload.startAt).getTime();
    const candidates = await prisma.eventSourceLink.findMany({
      where: { sourceId },
      select: { eventId: true },
    });
    for (const c of candidates) {
      const ev = await prisma.celebrityEvent.findUnique({
        where: { id: c.eventId },
        select: { id: true, eventId: true, name: true, startAt: true },
      });
      if (!ev) continue;
      if (normalizeName(ev.name) === normalizeName(payload.eventName) && Math.abs(new Date(ev.startAt).getTime() - start) < 6 * 3600 * 1000) {
        return { id: ev.id, eventId: ev.eventId };
      }
    }
  }
  return null;
}

async function applyEventNews(
  ev: MatchedEvent,
  payload: TicketSyncPayload,
  sourceKey: string,
): Promise<{ cancelled: number; rescheduled: number }> {
  const current = await prisma.celebrityEvent.findUnique({
    where: { id: ev.id },
    select: { id: true, eventId: true, statusOverride: true, status: true, startAt: true, endAt: true, allDay: true, timezone: true, venue: true, city: true, ticketUrl: true },
  });
  if (!current) return { cancelled: 0, rescheduled: 0 };

  const data: Record<string, unknown> = {};
  const changed: string[] = [];
  const noteParts: string[] = [];

  // Cancelled / postponed → the source's authoritative word.
  if (payload.statusOverride === "CANCELLED" || payload.statusOverride === "POSTPONED") {
    if (current.statusOverride !== payload.statusOverride) {
      data.statusOverride = payload.statusOverride;
      data.status = payload.statusOverride;
      data.verification = payload.statusOverride === "CANCELLED" ? "CANCELLED" : "POSTPONED";
      changed.push(payload.statusOverride === "CANCELLED" ? "cancelled" : "postponed");
      noteParts.push(`Reported ${payload.statusOverride.toLowerCase()} by ${sourceKey}.`);
    }
  }

  // Rescheduled → update the public dates.
  if (payload.rescheduled) {
    const newStart = payload.rescheduled.startAt ? new Date(payload.rescheduled.startAt) : null;
    const newEnd = payload.rescheduled.endAt ? new Date(payload.rescheduled.endAt) : payload.rescheduled.endAt === null ? null : undefined;
    if (newStart && newStart.getTime() !== new Date(current.startAt).getTime()) data.startAt = newStart;
    if (newEnd !== undefined) data.endAt = newEnd ?? null;
    if (newStart || newEnd !== undefined) {
      if (newStart) data.lastSyncedAt = new Date();
      changed.push("rescheduled");
      noteParts.push(payload.rescheduled.note ? `Rescheduled: ${payload.rescheduled.note}` : "Rescheduled by the ticketing source.");
    }
  }

  // Venue / city change from the source.
  if (payload.venueChanged && payload.venueChanged !== current.venue) {
    data.venue = payload.venueChanged;
    changed.push("venue");
    noteParts.push(`Venue changed to "${payload.venueChanged}".`);
  }
  if (payload.cityChanged && payload.cityChanged !== current.city) {
    data.city = payload.cityChanged;
    changed.push("city");
  }

  // Official ticket link.
  if (payload.officialTicketUrl && payload.officialTicketUrl !== current.ticketUrl) {
    data.ticketUrl = payload.officialTicketUrl;
    changed.push("ticketUrl");
  }

  if (changed.length === 0) return { cancelled: 0, rescheduled: 0 };

  if (data.statusOverride === undefined) {
    data.status = computeEventStatus({
      statusOverride: (current.statusOverride as string | null) ?? null,
      startAt: (data.startAt as Date | undefined) ?? current.startAt,
      endAt: (data.endAt as Date | null | undefined) ?? (current.endAt as Date | null),
      allDay: current.allDay,
    });
  }
  data.lastSyncedAt = new Date();
  data.updatedAt = new Date();

  const updated = await prisma.celebrityEvent.update({ where: { id: ev.id }, data });
  await prisma.eventUpdate.create({
    data: {
      eventId: ev.id,
      field: changed.join(", "),
      fromValue: JSON.stringify({ status: current.status, statusOverride: current.statusOverride, startAt: current.startAt, eventId: current.eventId }),
      toValue: JSON.stringify({ status: updated.status, statusOverride: updated.statusOverride, startAt: updated.startAt }),
      note: noteParts.join(" ") || null,
      source: sourceKey,
    },
  }).catch(() => undefined);

  return { cancelled: changed.includes("cancelled") ? 1 : 0, rescheduled: changed.includes("rescheduled") ? 1 : 0 };
}

type UpsertResult = { created: boolean; updated: boolean };

async function upsertInventory(eventId: string, sourceId: string, rec: TicketInventoryRecord): Promise<UpsertResult> {
  const status = rec.status ?? "AVAILABLE";

  // Dedupe by provider id first.
  let row = rec.externalId
    ? await prisma.ticketInventory.findFirst({ where: { eventId, sourceId, externalId: rec.externalId as string } })
    : null;
  // Fallback dedupe: same name + price on the same event+source.
  if (!row) {
    const norm = normalizeName(rec.name);
    const candidates = await prisma.ticketInventory.findMany({ where: { eventId, sourceId } });
    row = candidates.find((c) => normalizeName(c.name) === norm && c.priceCents === rec.priceCents) ?? null;
  }

  const data = {
    name: rec.name,
    category: rec.category ?? null,
    priceCents: Math.round(rec.priceCents),
    feesCents: Math.round(rec.feesCents ?? 0),
    currency: rec.currency || "USD",
    quantityAvailable: rec.quantityAvailable ?? null,
    quantityTotal: rec.quantityTotal ?? null,
    status,
    url: rec.url ?? null,
    saleStartAt: rec.saleStartAt ? new Date(rec.saleStartAt) : null,
    saleEndAt: rec.saleEndAt ? new Date(rec.saleEndAt) : null,
    lastSyncedAt: new Date(),
  };

  if (row) {
    const changed =
      row.priceCents !== data.priceCents ||
      row.feesCents !== data.feesCents ||
      row.status !== data.status ||
      row.quantityAvailable !== data.quantityAvailable ||
      row.name !== data.name ||
      row.currency !== data.currency;
    if (!changed) return { created: false, updated: false };
    await prisma.ticketInventory.update({ where: { id: row.id }, data: { ...data, updatedAt: new Date() } });
    return { created: false, updated: true };
  }

  await prisma.ticketInventory.create({ data: { eventId, sourceId, externalId: rec.externalId ?? null, ...data } });
  return { created: true, updated: false };
}

async function recomputePastStatuses() {
  const now = new Date();
  const past = await prisma.celebrityEvent.findMany({
    where: { celebrity: { isActive: true } },
    select: { id: true, statusOverride: true, status: true, startAt: true, endAt: true, allDay: true },
  });
  for (const ev of past) {
    const derived = computeEventStatus({
      statusOverride: ev.statusOverride,
      startAt: ev.startAt,
      endAt: ev.endAt,
      allDay: ev.allDay,
      now,
    });
    if (ev.status !== derived) {
      await prisma.celebrityEvent.update({ where: { id: ev.id }, data: { status: derived, updatedAt: now } }).catch(() => undefined);
    }
  }
}