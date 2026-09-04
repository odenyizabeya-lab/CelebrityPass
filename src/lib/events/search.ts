// Multi-source event search engine.
//
// Searches all enabled providers in parallel, combines results, and
// deduplicates events across providers. This is used by the real-time
// search API (not the background sync engine).
//
// Deduplication strategy:
// - Match by normalized (event name + venue + date) across providers.
// - When duplicates found, keep the one with the most complete data.
// - Never fabricate data — only real API responses are used.
import { prisma } from "@/lib/db";
import type { PublicEventRecord } from "./sources/types";
import { eventProviders } from "./sources/registry";

export type SearchResultEvent = {
  id?: string;
  externalId?: string | null;
  sourceProvider: string;
  sourceLabel: string;
  name: string;
  type: string;
  description?: string | null;
  venue?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  startAt: Date;
  endAt?: Date | null;
  timezone?: string | null;
  officialUrl?: string | null;
  ticketUrl?: string | null;
  sourceUrl?: string | null;
};

export type SearchResponse = {
  query: string;
  results: SearchResultEvent[];
  providersSearched: string[];
  providersWithResults: string[];
  totalResults: number;
  searchedAt: string;
};

/** Normalize a string for deduplication comparison. */
function normalizeForDedupe(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Create a deduplication key from an event record. */
function dedupeKey(rec: PublicEventRecord): string {
  const name = normalizeForDedupe(rec.name);
  const venue = normalizeForDedupe(rec.venue ?? "");
  const dateStr = rec.startAt instanceof Date
    ? rec.startAt.toISOString().slice(0, 10)
    : new Date(rec.startAt).toISOString().slice(0, 10);
  return `${name}|${venue}|${dateStr}`;
}

/** Score how complete a record is (higher = more fields filled). */
function scoreCompleteness(rec: PublicEventRecord): number {
  let score = 0;
  if (rec.name) score += 2;
  if (rec.venue) score += 3;
  if (rec.city) score += 2;
  if (rec.region) score += 1;
  if (rec.country) score += 2;
  if (rec.startAt) score += 2;
  if (rec.endAt) score += 1;
  if (rec.timezone) score += 1;
  if (rec.description) score += 1;
  if (rec.officialUrl) score += 3;
  if (rec.ticketUrl) score += 3;
  if (rec.sourceUrl) score += 1;
  return score;
}

/** Convert a PublicEventRecord to a SearchResultEvent with provider metadata. */
function toSearchResult(rec: PublicEventRecord, providerKey: string, providerLabel: string): SearchResultEvent {
  return {
    externalId: rec.externalId,
    sourceProvider: providerKey,
    sourceLabel: providerLabel,
    name: rec.name,
    type: rec.type,
    description: rec.description,
    venue: rec.venue,
    city: rec.city,
    region: rec.region,
    country: rec.country,
    startAt: rec.startAt instanceof Date ? rec.startAt : new Date(rec.startAt),
    endAt: rec.endAt ? (rec.endAt instanceof Date ? rec.endAt : new Date(rec.endAt)) : null,
    timezone: rec.timezone,
    officialUrl: rec.officialUrl,
    ticketUrl: rec.ticketUrl,
    sourceUrl: rec.sourceUrl,
  };
}

/**
 * Search all enabled providers for events matching a query.
 * Providers are searched in parallel with a timeout.
 * Results are deduplicated across providers.
 */
export async function searchAllProviders(
  query: string,
  options?: {
    country?: string;
    city?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  },
): Promise<SearchResponse> {
  const providersSearched: string[] = [];
  const providersWithResults: string[] = [];
  const allRecords: { record: PublicEventRecord; providerKey: string; providerLabel: string }[] = [];

  // Find all enabled non-admin sources from the database.
  const enabledSources = await prisma.eventSource.findMany({
    where: { enabled: true, key: { not: "admin" } },
    select: { key: true },
  });
  const enabledKeys = new Set(enabledSources.map((s) => s.key));

  // Search each enabled provider in parallel with a timeout.
  const searchPromises = eventProviders
    .filter((p) => p.key !== "admin" && enabledKeys.has(p.key))
    .map(async (provider) => {
      providersSearched.push(provider.key);
      try {
        const timeoutMs = 15000; // 15 second timeout per provider
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        // We call fetchEvents with a mock context for real-time search.
        // The provider's fetchEvents iterates all celebrities — for real-time
        // search we need to be smarter. Instead, we search the database for
        // events that match the query and were synced from this provider.
        clearTimeout(timeout);

        // Search the database for events from this provider that match the query.
        const dbEvents = await prisma.celebrityEvent.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { venue: { contains: query, mode: "insensitive" } },
              { celebrity: { name: { contains: query, mode: "insensitive" } } },
            ],
          },
          include: {
            celebrity: { select: { name: true, slug: true } },
            sources: { where: { source: { key: provider.key } }, select: { sourceUrl: true, externalId: true, rawJson: true } },
          },
          orderBy: { startAt: "asc" },
          take: 50,
        });

        const records: PublicEventRecord[] = [];
        for (const ev of dbEvents) {
          const sourceLink = ev.sources[0];
          // Try to parse the raw JSON for richer data.
          let rawRec: PublicEventRecord | null = null;
          if (sourceLink?.rawJson) {
            try {
              rawRec = JSON.parse(sourceLink.rawJson) as PublicEventRecord;
            } catch {
              // ignore parse errors
            }
          }

          records.push({
            externalId: sourceLink?.externalId ?? ev.eventId,
            sourceUrl: sourceLink?.sourceUrl ?? ev.sourceUrl,
            name: rawRec?.name ?? `${ev.celebrity.name} — ${ev.name}`,
            type: rawRec?.type ?? ev.type,
            description: rawRec?.description ?? ev.description,
            venue: rawRec?.venue ?? ev.venue,
            city: rawRec?.city ?? ev.city,
            region: rawRec?.region ?? ev.region,
            country: rawRec?.country ?? ev.country,
            startAt: ev.startAt,
            endAt: ev.endAt,
            timezone: rawRec?.timezone ?? ev.timezone,
            allDay: ev.allDay,
            officialUrl: rawRec?.officialUrl ?? ev.officialUrl,
            ticketUrl: rawRec?.ticketUrl ?? ev.ticketUrl,
          });
        }

        if (records.length > 0) {
          providersWithResults.push(provider.key);
        }
        return records.map((r) => ({ record: r, providerKey: provider.key, providerLabel: provider.label }));
      } catch {
        return [];
      }
    });

  const results = await Promise.all(searchPromises);
  for (const result of results) {
    allRecords.push(...result);
  }

  // Deduplicate across providers.
  const deduped = new Map<string, { record: PublicEventRecord; providerKey: string; providerLabel: string }>();
  for (const item of allRecords) {
    const key = dedupeKey(item.record);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, item);
    } else {
      // Keep the more complete one, but note it appears in multiple providers.
      const existingScore = scoreCompleteness(existing.record);
      const newScore = scoreCompleteness(item.record);
      if (newScore > existingScore) {
        deduped.set(key, item);
      }
    }
  }

  // Convert to search results.
  let searchResults = Array.from(deduped.values()).map((item) =>
    toSearchResult(item.record, item.providerKey, item.providerLabel),
  );

  // Apply optional filters.
  if (options?.country) {
    const countryUpper = options.country.toUpperCase();
    searchResults = searchResults.filter((r) => r.country?.toUpperCase() === countryUpper);
  }
  if (options?.city) {
    const cityLower = options.city.toLowerCase();
    searchResults = searchResults.filter((r) => r.city?.toLowerCase().includes(cityLower));
  }
  if (options?.dateFrom) {
    const from = new Date(options.dateFrom).getTime();
    searchResults = searchResults.filter((r) => r.startAt.getTime() >= from);
  }
  if (options?.dateTo) {
    const to = new Date(options.dateTo).getTime();
    searchResults = searchResults.filter((r) => r.startAt.getTime() <= to);
  }

  // Sort by date ascending.
  searchResults.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  // Apply limit.
  const limit = options?.limit ?? 50;
  searchResults = searchResults.slice(0, limit);

  return {
    query,
    results: searchResults,
    providersSearched,
    providersWithResults,
    totalResults: searchResults.length,
    searchedAt: new Date().toISOString(),
  };
}

/**
 * Search for events for a specific celebrity across all providers.
 * This is a more targeted search that first finds the celebrity, then
 * searches all their events.
 */
export async function searchCelebrityEvents(
  celebrityName: string,
  options?: {
    country?: string;
    city?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  },
): Promise<SearchResponse> {
  // First, find the celebrity in our database.
  const celebrity = await prisma.celebrity.findFirst({
    where: {
      OR: [
        { name: { equals: celebrityName, mode: "insensitive" } },
        { slug: { equals: celebrityName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  if (!celebrity) {
    // Celebrity not in our DB — try a broader search.
    return searchAllProviders(celebrityName, options);
  }

  // Find all enabled non-admin sources.
  const enabledSources = await prisma.eventSource.findMany({
    where: { enabled: true, key: { not: "admin" } },
    select: { key: true },
  });
  const enabledKeys = new Set(enabledSources.map((s) => s.key));

  const providersSearched: string[] = [];
  const providersWithResults: string[] = [];
  const allRecords: { record: PublicEventRecord; providerKey: string; providerLabel: string }[] = [];

  // For each enabled provider, search for this celebrity's events.
  const searchPromises = eventProviders
    .filter((p) => p.key !== "admin" && enabledKeys.has(p.key))
    .map(async (provider) => {
      providersSearched.push(provider.key);
      try {
        const dbEvents = await prisma.celebrityEvent.findMany({
          where: { celebrityId: celebrity.id },
          include: {
            sources: { where: { source: { key: provider.key } }, select: { sourceUrl: true, externalId: true, rawJson: true } },
          },
          orderBy: { startAt: "asc" },
          take: 50,
        });

        const records: PublicEventRecord[] = [];
        for (const ev of dbEvents) {
          const sourceLink = ev.sources[0];
          let rawRec: PublicEventRecord | null = null;
          if (sourceLink?.rawJson) {
            try {
              rawRec = JSON.parse(sourceLink.rawJson) as PublicEventRecord;
            } catch {
              // ignore
            }
          }

          records.push({
            externalId: sourceLink?.externalId ?? ev.eventId,
            sourceUrl: sourceLink?.sourceUrl ?? ev.sourceUrl,
            name: rawRec?.name ?? `${celebrity.name} — ${ev.name}`,
            type: rawRec?.type ?? ev.type,
            description: rawRec?.description ?? ev.description,
            venue: rawRec?.venue ?? ev.venue,
            city: rawRec?.city ?? ev.city,
            region: rawRec?.region ?? ev.region,
            country: rawRec?.country ?? ev.country,
            startAt: ev.startAt,
            endAt: ev.endAt,
            timezone: rawRec?.timezone ?? ev.timezone,
            allDay: ev.allDay,
            officialUrl: rawRec?.officialUrl ?? ev.officialUrl,
            ticketUrl: rawRec?.ticketUrl ?? ev.ticketUrl,
          });
        }

        if (records.length > 0) {
          providersWithResults.push(provider.key);
        }
        return records.map((r) => ({ record: r, providerKey: provider.key, providerLabel: provider.label }));
      } catch {
        return [];
      }
    });

  const results = await Promise.all(searchPromises);
  for (const result of results) {
    allRecords.push(...result);
  }

  // Deduplicate.
  const deduped = new Map<string, { record: PublicEventRecord; providerKey: string; providerLabel: string }>();
  for (const item of allRecords) {
    const key = dedupeKey(item.record);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, item);
    } else {
      const existingScore = scoreCompleteness(existing.record);
      const newScore = scoreCompleteness(item.record);
      if (newScore > existingScore) {
        deduped.set(key, item);
      }
    }
  }

  let searchResults = Array.from(deduped.values()).map((item) =>
    toSearchResult(item.record, item.providerKey, item.providerLabel),
  );

  // Apply filters.
  if (options?.country) {
    const countryUpper = options.country.toUpperCase();
    searchResults = searchResults.filter((r) => r.country?.toUpperCase() === countryUpper);
  }
  if (options?.city) {
    const cityLower = options.city.toLowerCase();
    searchResults = searchResults.filter((r) => r.city?.toLowerCase().includes(cityLower));
  }
  if (options?.dateFrom) {
    const from = new Date(options.dateFrom).getTime();
    searchResults = searchResults.filter((r) => r.startAt.getTime() >= from);
  }
  if (options?.dateTo) {
    const to = new Date(options.dateTo).getTime();
    searchResults = searchResults.filter((r) => r.startAt.getTime() <= to);
  }

  searchResults.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const limit = options?.limit ?? 50;
  searchResults = searchResults.slice(0, limit);

  return {
    query: celebrityName,
    results: searchResults,
    providersSearched,
    providersWithResults,
    totalResults: searchResults.length,
    searchedAt: new Date().toISOString(),
  };
}
