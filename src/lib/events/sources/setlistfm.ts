// setlist.fm API event provider.
//
// Pulls upcoming setlists (concert events) from the setlist.fm API
// (https://api.setlist.fm/docs/1.0/index.html).
// Requires a free API key registered at setlist.fm/settings/api.
// The key is read from the admin-managed AppSetting (with a fallback to the
// SETLISTFM_API_KEY env var) — never from the browser.
//
// Only publicly announced events are fetched; nothing is ever fabricated.
import type { PrismaClient } from "@prisma/client";
import type { PublicEventProvider, PublicEventFetchResult, PublicEventRecord, ProviderOptions } from "./types";

const API_BASE = "https://api.setlist.fm/rest/1.0";
const SETLISTFM_API_KEY_SETTING = "setlistfm_api_key";

async function getApiKey(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<string> {
  const setting = await ctx.prisma.appSetting.findUnique({ where: { key: SETLISTFM_API_KEY_SETTING } });
  if (setting?.value?.trim()) return setting.value.trim();
  return process.env.SETLISTFM_API_KEY?.trim() ?? "";
}

async function searchArtist(
  name: string,
  apiKey: string,
): Promise<string | null> {
  const url = `${API_BASE}/search/artists?artistName=${encodeURIComponent(name)}&p=1`;
  const res = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { artist?: { mbid?: string }[]; total?: number };
  const artists = data.artist;
  if (!artists || artists.length === 0) return null;
  // Return the first result's MBID.
  return artists[0].mbid ?? null;
}

function toRecord(
  sl: {
    id?: string;
    eventDate?: string;
    tour?: { name?: string };
    venue?: {
      name?: string;
      city?: { name?: string; state?: string; country?: { code?: string; name?: string } };
    };
    url?: string;
    artist?: { name?: string };
  },
  artistName: string,
): PublicEventRecord | null {
  const venue = sl.venue;
  const city = venue?.city;
  const name = `${artistName} — ${sl.tour?.name ?? "Live"}`;
  if (!name || name.length === 0) return null;

  // setlist.fm dates are in DD-MM-YYYY format.
  let startDate: Date;
  if (sl.eventDate) {
    const parts = sl.eventDate.split("-");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      startDate = new Date(`${year}-${month}-${day}T20:00:00Z`);
    } else {
      return null;
    }
  } else {
    return null;
  }
  if (isNaN(startDate.getTime())) return null;

  return {
    externalId: sl.id ?? null,
    sourceUrl: sl.url ? `https://www.setlist.fm${sl.url}` : null,
    name,
    type: "Concert",
    description: sl.tour?.name ? `Tour: ${sl.tour.name}` : null,
    venue: venue?.name ?? null,
    city: city?.name ?? null,
    region: city?.state ?? null,
    country: city?.country?.code ?? null,
    startAt: startDate,
    endAt: null,
    timezone: null,
    allDay: false,
    officialUrl: sl.url ? `https://www.setlist.fm${sl.url}` : null,
    ticketUrl: null,
  };
}

export const setlistFmProvider: PublicEventProvider = {
  key: "setlistfm",
  label: "setlist.fm — real concert setlists & upcoming events",
  requiresCredentials: true,
  credentialEnvVars: ["SETLISTFM_API_KEY"],
  async fetchEvents(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<PublicEventFetchResult> {
    const apiKey = await getApiKey(ctx);
    if (!apiKey) {
      return {
        records: [],
        message:
          "setlist.fm API key not configured. Register free at setlist.fm/settings/api, then paste your key in Admin → Event settings.",
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
        // First search for the artist's MusicBrainz ID.
        const mbid = await searchArtist(celeb.name, apiKey);
        if (!mbid) continue; // artist not found — not an error

        // Then get their upcoming setlists/events.
        const url = `${API_BASE}/artist/${mbid}/setlists?p=1`;
        const res = await fetch(url, {
          headers: {
            "x-api-key": apiKey,
            Accept: "application/json",
          },
        });

        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        if (!res.ok) {
          errors++;
          continue;
        }

        const data = (await res.json()) as { setlist?: unknown[]; total?: number };
        const setlists = data.setlist ?? [];

        for (const sl of setlists.slice(0, 20)) {
          const rec = toRecord(sl as Parameters<typeof toRecord>[0], celeb.name);
          if (rec) records.push(rec);
        }
        await new Promise((r) => setTimeout(r, 300)); // setlist.fm rate-limit
      } catch {
        errors++;
      }
    }

    const message =
      errors > 0
        ? `Fetched ${records.length} event(s) from setlist.fm (${errors} lookups failed or rate-limited).`
        : `Fetched ${records.length} event(s) from setlist.fm.`;
    return { records, message };
  },
};
