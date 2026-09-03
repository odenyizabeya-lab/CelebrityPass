// Ticketmaster Discovery API event provider.
//
// Real, publicly announced events are pulled from Ticketmaster's Discovery API
// (free developer key). The key is read from the admin-managed AppSetting (with
// a fallback to the EVENT_TICKETING_API_KEY env var) — never from the browser.
//
// We search events by each active celebrity's name, map them to the platform's
// PublicEventRecord shape, and let the sync engine match them to the correct
// celebrity. Anything ambiguous is skipped; nothing is ever fabricated.
import type { PrismaClient } from "@prisma/client";
import type { PublicEventProvider, PublicEventFetchResult, PublicEventRecord, ProviderOptions } from "./types";
import { getTicketmasterApiKey } from "./ticketing-settings";

const API_BASE = "https://app.ticketmaster.com/discovery/v2";

async function getApiKey(): Promise<string> {
  return getTicketmasterApiKey();
}

/** Decode a human-friendly event type from Ticketmaster's classification. */
function eventType(classification: unknown[]): string {
  const primary = classification?.[0] as { segment?: { name?: string }; genre?: { name?: string } } | undefined;
  if (primary?.segment?.name) {
    const seg = primary.segment.name.toLowerCase();
    const gen = primary.genre?.name?.toLowerCase() ?? "";
    if (seg.includes("music")) return gen.includes("concert") ? "Concert" : "Concert";
    if (seg.includes("sports")) return "Sporting Event";
    if (seg.includes("arts")) return "Arts & Theatre";
    if (seg.includes("film")) return "Film";
    if (seg.includes("family")) return "Family";
    return "Event";
  }
  return "Other";
}

function toRecord(ev: {
  id?: string;
  name?: string;
  url?: string;
  dates?: { start?: { dateTime?: string; localDate?: string; localTime?: string; timezone?: string; noSpecificTime?: boolean } };
  _embedded?: { venues?: { name?: string; city?: { name?: string }; state?: { stateCode?: string }; country?: { countryCode?: string } }[]; attractions?: { name?: string }[] };
  classification?: unknown[];
}): PublicEventRecord | null {
  const name = ev.name?.trim();
  const start = ev.dates?.start;
  if (!name || name.length === 0) return null;

  // Build a UTC date from Ticketmaster's local date/time + timezone.
  let startDate: Date;
  const zone = start?.timezone;
  const localDateTime = start?.dateTime; // already ISO with offset when timezone-present
  if (localDateTime) {
    startDate = new Date(localDateTime);
  } else if (start?.localDate) {
    const time = start.localTime || "00:00:00";
    // Ticketmaster omits a real offset for local-only values; fall back to UTC to stay honest.
    const iso = `${start.localDate}T${time}${zone ? "Z" : "Z"}`;
    startDate = new Date(isNaN(Date.parse(iso)) ? new Date(`${start.localDate}T00:00:00Z`) : Date.parse(iso));
  } else {
    return null; // no usable date -> skip (never guess)
  }
  if (isNaN(startDate.getTime())) return null;

  const venue = ev._embedded?.venues?.[0];
  const cityName = venue?.city?.name;
  const region = venue?.state?.stateCode ?? undefined;
  const country = venue?.country?.countryCode ?? undefined;

  return {
    externalId: ev.id ?? null,
    sourceUrl: ev.url ?? null,
    name,
    type: eventType(ev.classification ?? []),
    venue: venue?.name ?? null,
    city: cityName ?? null,
    region: region ?? null,
    country: country ?? null,
    startAt: startDate,
    endAt: null,
    timezone: zone ?? null,
    allDay: Boolean(start?.noSpecificTime),
    officialUrl: ev.url ?? null,
    ticketUrl: ev.url ?? null,
  };
}

export const ticketmasterProvider: PublicEventProvider = {
  key: "ticketmaster",
  label: "Ticketmaster — real concerts, sports & theatre events",
  requiresCredentials: true,
  credentialEnvVars: ["EVENT_TICKETING_API_KEY"], // env fallback; admin-pasted key also works
  async fetchEvents(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<PublicEventFetchResult> {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return {
        records: [],
        message:
          "Ticketmaster key not configured. Paste your free API key (developer.ticketmaster.com) in Admin → Event settings.",
      };
    }

    const celebrities = await ctx.prisma.celebrity.findMany({
      where: { isActive: true },
      select: { name: true, slug: true },
    });

    const records: PublicEventRecord[] = [];
    let errors = 0;

    for (const celeb of celebrities) {
      try {
        const url =
          `${API_BASE}/events.json?keyword=${encodeURIComponent(celeb.name)}` +
          `&apikey=${encodeURIComponent(apiKey)}&size=20&sort=date,asc`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (res.status === 429) {
          // rate-limited: back off and continue (honest, transient)
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          errors++;
          continue; // bad/expired key — other celebrities won't work either; will surface via message below
        }
        if (!res.ok) {
          errors++;
          continue;
        }
        const data = (await res.json()) as Record<string, unknown>;
        const events = (data as { _embedded?: { events?: unknown[] } })?._embedded?.events ?? [];
        for (const e of events.slice(0, 20)) {
          const rec = toRecord(e as Parameters<typeof toRecord>[0]);
          if (rec) records.push(rec);
        }
        // Be a good citizen: 2 concurrent-series is too little; we just do sequential + small delay.
        await new Promise((r) => setTimeout(r, 120));
      } catch {
        errors++;
      }
    }

    const message =
      errors > 0
        ? `Fetched ${records.length} event record(s) (${errors} celebrity lookups failed or rate-limited).`
        : `Fetched ${records.length} event record(s).`;
    return { records, message };
  },
};