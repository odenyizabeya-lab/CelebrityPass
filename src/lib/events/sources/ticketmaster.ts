// Ticketmaster Discovery API v2 event provider.
//
// Pulls publicly listed concerts/shows from the official Ticketmaster
// Discovery API (https://app.ticketmaster.com/discovery/v2/events.json).
// Registration for an API key is free (https://developer.ticketmaster.com);
// the key is read from admin settings (AppSetting) or the
// EVENT_TICKETING_API_KEY env var — never from the browser.
//
// Only publicly announced events are fetched; nothing is ever fabricated.
// When no key is configured the provider returns an empty, honest result.
import type { PrismaClient } from "@prisma/client";
import type { PublicEventProvider, PublicEventFetchResult, PublicEventRecord, ProviderOptions } from "./types";
import { ProviderError } from "./types";
import { getProviderKey } from "./provider-settings";

const API_BASE = "https://app.ticketmaster.com";
const EVENTS_URL = `${API_BASE}/discovery/v2/events.json`;
const DEFAULT_DAYS_AHEAD = 550;
const MAX_PER_CELEBRITY = 100;
const PAGE_SIZE = 50;

type TmEvent = {
  id?: string;
  name?: string;
  url?: string;
  info?: string;
  dates?: {
    timezone?: string;
    status?: { code?: string };
    start?: { dateTime?: string; localDate?: string; localTime?: string };
    end?: { dateTime?: string; localDate?: string; localTime?: string };
  };
  classifications?: { segment?: { name?: string } }[];
  _embedded?: {
    venues?: { name?: string; city?: { name?: string }; state?: { name?: string }; country?: { name?: string } }[];
  };
};

type TmResponse = {
  _embedded?: { events?: TmEvent[] };
  page?: { number?: number; totalPages?: number };
};

function mapEventType(ev: TmEvent): string {
  const seg = (ev.classifications?.[0]?.segment?.name ?? "").toLowerCase();
  const name = (ev.name ?? "").toLowerCase();
  if (seg === "music") {
    if (name.includes("festival")) return "Festival";
    return "Concert";
  }
  if (seg === "sports") return "Sports appearance";
  return "Other";
}

function parseStart(ev: TmEvent): Date | null {
  const start = ev.dates?.start;
  if (!start) return null;
  const raw = start.dateTime ?? (start.localDate && start.localTime ? `${start.localDate}T${start.localTime}Z` : start.localDate ? `${start.localDate}T00:00:00Z` : null);
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchEventsPage(apiKey: string, celebrityName: string, startIso: string, endIso: string, page: number, size: number): Promise<TmEvent[]> {
  const params = new URLSearchParams({
    apikey: apiKey,
    keyword: celebrityName,
    size: String(size),
    page: String(page),
    sort: "date,asc",
    startDateTime: startIso,
    endDateTime: endIso,
    includeTBA: "no",
    includeTest: "no",
  });
  const res = await fetch(`${EVENTS_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError("Ticketmaster API rejected the key (401/403). Check the key in admin settings.");
  }
  if (!res.ok) {
    throw new ProviderError(`Ticketmaster API returned status ${res.status}.`);
  }
  const data = (await res.json()) as TmResponse;
  return data._embedded?.events ?? [];
}

export const ticketmasterProvider: PublicEventProvider = {
  key: "ticketmaster",
  label: "Ticketmaster — official US & Europe concert/show listings",
  requiresCredentials: true,
  credentialEnvVars: ["EVENT_TICKETING_API_KEY"],
  async fetchEvents(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<PublicEventFetchResult> {
    const config = ctx.options.config ?? {};
    const daysAhead = typeof config.daysAhead === "number" ? config.daysAhead : DEFAULT_DAYS_AHEAD;

    const apiKey = await getProviderKey("ticketmaster");
    if (!apiKey) {
      return {
        records: [],
        message: "Ticketmaster key not configured yet — add it in Admin → Events → API Keys and save.",
      };
    }

    const celebrities = await ctx.prisma.celebrity.findMany({
      where: { isActive: true },
      select: { name: true, slug: true },
    });

    const records: PublicEventRecord[] = [];
    const now = new Date();
    // Ticketmaster requires the exact format YYYY-MM-DDTHH:mm:ssZ (no millis).
    const toApiIso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;
    const startIso = toApiIso(now);
    const endIso = toApiIso(new Date(now.getTime() + daysAhead * 24 * 3600 * 1000));
    let errors = 0;

    for (const celeb of celebrities) {
      try {
        // Up to two pages (100 events) per celebrity, soonest first.
        for (let page = 0; page < Math.ceil(MAX_PER_CELEBRITY / PAGE_SIZE); page++) {
          const events = await fetchEventsPage(apiKey, celeb.name, startIso, endIso, page, PAGE_SIZE);
          for (const ev of events) {
            const id = ev.id;
            if (!id || !ev.name) continue;
            const startAt = parseStart(ev);
            if (!startAt) continue;

            const venue = ev._embedded?.venues?.[0];
            records.push({
              externalId: id,
              sourceUrl: ev.url ?? null,
              name: `${celeb.name} — ${ev.name}`,
              type: mapEventType(ev),
              description: ev.info ? (ev.info.length > 600 ? `${ev.info.slice(0, 597)}…` : ev.info) : null,
              venue: venue?.name ?? null,
              city: venue?.city?.name ?? null,
              region: venue?.state?.name ?? null,
              country: venue?.country?.name ?? null,
              startAt,
              endAt: ev.dates?.end?.dateTime ? new Date(ev.dates.end.dateTime) : null,
              timezone: ev.dates?.timezone ?? null,
              allDay: false,
              officialUrl: ev.url ?? null,
              ticketUrl: ev.url ?? null,
              statusOverride: ev.dates?.status?.code === "cancelled" ? "CANCELLED" : ev.dates?.status?.code === "postponed" || ev.dates?.status?.code === "rescheduled" ? "POSTPONED" : null,
            });
          }
          if (events.length < PAGE_SIZE) break;
        }
        await new Promise((r) => setTimeout(r, 600)); // stay well under 5 req/sec
      } catch {
        errors++;
      }
    }

    const message = errors > 0
      ? `Fetched ${records.length} event(s) from Ticketmaster (${errors} celebrity lookup(s) failed).`
      : `Fetched ${records.length} event(s) from Ticketmaster.`;
    return { records, message };
  },
};