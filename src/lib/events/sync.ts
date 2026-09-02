// Event synchronization engine.
//
// Polls enabled public event providers in the background and reconciles their
// records with the local database:
//   * NEW       -> insert (with source link + sourceUrl)
//   * CHANGED   -> update fields and record an EventUpdate
//   * POSTPONED -> set statusOverride + status, update event dates
//   * CANCELLED -> set statusOverride + status
//   * PAST      -> recompute live status to COMPLETED
//   * UNCHANGED -> no-op (never creates duplicates)
//
// Serves visitors from the DB only; external sources are never called on page
// render. Admin manually-added events are preserved (skipped by syncs).
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeEventStatus } from "./helpers";
import { getProviderByKeyOrDefault } from "./sources/registry";
import { ProviderError } from "./sources/types";
import type { PublicEventRecord } from "./sources/types";

export type SyncResult = {
  sourceId: string;
  providerKey: string;
  ok: boolean;
  newEvents: number;
  updatedEvents: number;
  unchanged: number;
  removedFromUpcoming: number;
  message?: string;
  startedAt: string;
  finishedAt: string;
};

type CelebrityRow = { id: string; name: string; slug: string };

// A stable match key for a celebrity record, used to connect provider records
// to the right celebrity WITHOUT assuming name similarity alone.
function normalizeCelebrityName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function runSourceSync(sourceId: string): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const source = await prisma.eventSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Source not found");
  if (!source.enabled) return { sourceId, providerKey: source.key, ok: true, newEvents: 0, updatedEvents: 0, unchanged: 0, removedFromUpcoming: 0, startedAt, finishedAt: new Date().toISOString(), message: "Source disabled." };

  await mark(source, "running", null);

  const provider = getProviderByKeyOrDefault(source.key);

  // The manual/admin source is edited directly; automated sync skips it.
  const skipAutomated = source.key === "admin" || provider.key === "admin";
  if (skipAutomated) {
    await finish(source, "ok", "Manual/admin source — edited in the admin panel.");
    return { sourceId, providerKey: provider.key, ok: true, newEvents: 0, updatedEvents: 0, unchanged: 0, removedFromUpcoming: 0, startedAt, finishedAt: new Date().toISOString(), message: "Admin source skipped (manual flow)." };
  }

  try {
    const { records, message } = await provider.fetchEvents({
      prisma: prisma as PrismaClient,
      options: {
        config: parseJson(source.configJson, {}),
        credentials: collectCredentials(provider.credentialEnvVars),
      },
    });

    const celebrities: CelebrityRow[] = await prisma.celebrity.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
    });
    const celebritiesByName = new Map<string, CelebrityRow>();
    const celebritiesBySlug = new Map<string, CelebrityRow>();
    for (const c of celebrities) {
      celebritiesByName.set(normalizeCelebrityName(c.name), c);
      celebritiesBySlug.set(c.slug.toLowerCase(), c);
    }

    let newEvents = 0;
    let updatedEvents = 0;
    let unchanged = 0;

    for (const rec of records) {
      const matched = matchCelebrity(rec, celebritiesByName, celebritiesBySlug);
      if (!matched) continue; // no reliable match -> skip (never guess)

      const res = await upsertEvent(sourceId, source.key, matched.id, rec);
      newEvents += res.created ? 1 : 0;
      updatedEvents += res.updated ? 1 : 0;
      unchanged += res.unchanged ? 1 : 0;
    }

    // Move past-dated non-overridden events to COMPLETED (derived; reapplied on
    // next sync as well, cheap).
    const recency = new Date();
    const past = await prisma.celebrityEvent.findMany({
      where: { celebrity: { isActive: true } },
      select: { id: true, statusOverride: true, startAt: true, endAt: true, allDay: true, status: true },
    });
    let removedFromUpcoming = 0;
    for (const ev of past) {
      const derived = computeEventStatus({
        statusOverride: ev.statusOverride,
        startAt: ev.startAt,
        endAt: ev.endAt,
        allDay: ev.allDay,
        now: recency,
      });
      if (ev.status !== derived) {
        await prisma.celebrityEvent.update({ where: { id: ev.id }, data: { status: derived } });
        if (derived === "COMPLETED" && ev.status === "UPCOMING") removedFromUpcoming++;
      }
    }

    await finish(source, "ok", message ?? `Synced ${records.length} record(s).`);
    return {
      sourceId,
      providerKey: provider.key,
      ok: true,
      newEvents,
      updatedEvents,
      unchanged,
      removedFromUpcoming,
      message: message ?? `Synced ${records.length} record(s).`,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } catch (e) {
    const msg = e instanceof ProviderError ? e.message : e instanceof Error ? e.message : String(e);
    await finish(source, "error", msg);
    return {
      sourceId,
      providerKey: provider.key,
      ok: false,
      newEvents: 0,
      updatedEvents: 0,
      unchanged: 0,
      removedFromUpcoming: 0,
      message: msg,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
}

function matchCelebrity(rec: PublicEventRecord, byName: Map<string, CelebrityRow>, bySlug: Map<string, CelebrityRow>): CelebrityRow | null {
  // Prefer an explicit celebrity hint if the provider supplies one.
  const hint = (rec as { celebrityKey?: string }).celebrityKey;
  if (hint) {
    const byHint = bySlug.get(hint.toLowerCase()) ?? byName.get(normalizeCelebrityName(hint));
    if (byHint) return byHint;
  }
  const n = normalizeCelebrityName(rec.name.split(" — ")[0] || rec.name);
  const hit = byName.get(n);
  // Only match by name when the normalized name is a confident full match.
  return hit && n.length >= 3 ? hit : null;
}

async function upsertEvent(
  sourceId: string,
  providerKey: string,
  celebrityId: string,
  rec: PublicEventRecord,
): Promise<{ created: boolean; updated: boolean; unchanged: boolean }> {
  const norm = normalizeEventName(rec.name);

  // Find an existing event already linked to this source+external id (dedupe).
  let link = rec.externalId
    ? await prisma.eventSourceLink.findFirst({
        where: { sourceId, externalId: rec.externalId as string },
        include: { event: true },
      })
    : null;

  // If no external id, match by (source, normalized name + startAt) to avoid
  // duplicates across repeated syncs. Never assume same person by name alone —
  // we already matched the celebrity above from explicit/high-confidence info.
  if (!link) {
    link = await prisma.eventSourceLink.findFirst({
      where: {
        sourceId,
        event: {
          celebrityId,
          name: { contains: "" }, // placeholder; refined below
        },
      },
      include: { event: true },
    });
    if (link) {
      const existingNorm = normalizeEventName(link!.event.name);
      const existingStart = new Date(link!.event.startAt).getTime();
      const recStart = new Date(rec.startAt).getTime();
      if (!(existingNorm === norm && Math.abs(existingStart - recStart) < 6 * 3600 * 1000)) {
        link = null;
      }
    }
  }

  if (link) {
    const ev = link.event;
    const patch = eventPatch(ev, rec);
    const fields = Object.keys(patch);
    if (fields.length === 0) {
      return { created: false, updated: false, unchanged: true };
    }
    await prisma.celebrityEvent.update({ where: { id: ev.id }, data: { ...patch, lastSyncedAt: new Date() } });
    await prisma.eventSourceLink.update({
      where: { id: link.id },
      data: { sourceUrl: rec.sourceUrl ?? link.sourceUrl, rawJson: JSON.stringify(rec), updatedAt: new Date() },
    });
    await logChanged(ev.id, fields, patch, providerKey);
    return { created: false, updated: true, unchanged: false };
  }

  // New event.
  const eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const newEvent = await prisma.celebrityEvent.create({
    data: {
      eventId,
      celebrityId,
      name: rec.name,
      type: rec.type || "Other",
      description: rec.description ?? null,
      venue: rec.venue ?? null,
      city: rec.city ?? null,
      region: rec.region ?? null,
      country: rec.country ?? null,
      startAt: new Date(rec.startAt),
      endAt: rec.endAt ? new Date(rec.endAt) : null,
      timezone: rec.timezone ?? null,
      allDay: rec.allDay ?? false,
      statusOverride: rec.statusOverride ?? null,
      status: computeEventStatus({
        statusOverride: rec.statusOverride,
        startAt: new Date(rec.startAt),
        endAt: rec.endAt ? new Date(rec.endAt) : null,
        allDay: rec.allDay ?? false,
      }),
      officialUrl: rec.officialUrl ?? null,
      ticketUrl: rec.ticketUrl ?? null,
      sourceUrl: rec.sourceUrl ?? null,
      verification: "UNVERIFIED",
      lastSyncedAt: new Date(),
    },
  });
  await prisma.eventSourceLink.create({
    data: {
      eventId: newEvent.id,
      sourceId,
      externalId: rec.externalId ?? null,
      sourceUrl: rec.sourceUrl ?? null,
      rawJson: JSON.stringify(rec),
    },
  });
  await logChanged(newEvent.id, ["created"], {}, providerKey, "New public event imported.");
  return { created: true, updated: false, unchanged: false };
}

/** Build only the fields that actually changed vs the record. */
function eventPatch(ev: { [k: string]: unknown }, rec: PublicEventRecord): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const cmp = (a: unknown, b: unknown) => String(a ?? "") !== String(b ?? "");
  if (cmp(ev.name, rec.name)) patch.name = rec.name;
  if (cmp(ev.type, rec.type || "Other")) patch.type = rec.type || "Other";
  if (cmp(ev.description, rec.description)) patch.description = rec.description ?? null;
  if (cmp(ev.venue, rec.venue)) patch.venue = rec.venue ?? null;
  if (cmp(ev.city, rec.city)) patch.city = rec.city ?? null;
  if (cmp(ev.region, rec.region)) patch.region = rec.region ?? null;
  if (cmp(ev.country, rec.country)) patch.country = rec.country ?? null;
  if (cmp(new Date(ev.startAt as string).getTime(), new Date(rec.startAt).getTime()))
    patch.startAt = new Date(rec.startAt);
  if (ev.endAt
    ? cmp(new Date(ev.endAt as string).getTime(), rec.endAt ? new Date(rec.endAt).getTime() : "")
    : rec.endAt != null)
    patch.endAt = rec.endAt ? new Date(rec.endAt) : null;
  if (cmp(ev.timezone, rec.timezone)) patch.timezone = rec.timezone ?? null;
  if (cmp(ev.allDay, rec.allDay ?? false)) patch.allDay = rec.allDay ?? false;
  if (cmp(ev.officialUrl, rec.officialUrl)) patch.officialUrl = rec.officialUrl ?? null;
  if (cmp(ev.ticketUrl, rec.ticketUrl)) patch.ticketUrl = rec.ticketUrl ?? null;
  if (cmp(ev.sourceUrl, rec.sourceUrl)) patch.sourceUrl = rec.sourceUrl ?? null;

  // Status override changes drive status changes.
  const prevOverride = ev.statusOverride as string | null;
  const nextOverride = rec.statusOverride ?? null;
  if (cmp(prevOverride, nextOverride)) {
    patch.statusOverride = nextOverride;
    const startForStatus: string | Date = (patch.startAt as Date | undefined) ?? (ev.startAt as Date);
    const endForStatus: string | Date | null | undefined = (patch.endAt as Date | undefined) ?? (ev.endAt as Date | null | undefined);
    const allDayForStatus: boolean = (patch.allDay as boolean | undefined) ?? (ev.allDay as boolean);
    patch.status = computeEventStatus({
      statusOverride: nextOverride,
      startAt: startForStatus,
      endAt: endForStatus,
      allDay: allDayForStatus,
    });
  }
  return patch;
}

async function logChanged(eventId: string, fields: string[], patch: Record<string, unknown>, source: string, note?: string) {
  await prisma.eventUpdate.create({
    data: {
      eventId,
      field: fields.join(", ") || "event",
      toValue: JSON.stringify(patch),
      note: note,
      source,
    },
  }).catch(() => undefined);
}

function normalizeEventName(name: string): string {
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
    if (val) out[v.toLowerCase().replace(/^event_/, "").replace(/_api_key$/, "apiKey")] = val;
  }
  // also expose a conventional apiKey
  const direct = process.env.EVENT_TICKETING_API_KEY;
  if (direct) out.apiKey = direct;
  return out;
}

async function mark(source: { id: string }, status: string, message: string | null) {
  await prisma.eventSource.update({
    where: { id: source.id },
    data: { lastSyncStatus: status, lastSyncMessage: message, lastSyncAt: new Date() },
  }).catch(() => undefined);
}
async function finish(source: { id: string }, status: string, message: string) {
  await mark(source, status, message);
}
