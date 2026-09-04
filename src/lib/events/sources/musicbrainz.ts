// MusicBrainz API event provider.
//
// Pulls artist information and event data from the MusicBrainz API
// (https://musicbrainz.org/doc/MusicBrainz_API).
// MusicBrainz is free and open — no API key required for read access.
// We use it to enrich artist data and discover events via the
// "musicbrainz.org" linked events (when available).
//
// Only publicly announced events are fetched; nothing is ever fabricated.
import type { PrismaClient } from "@prisma/client";
import type { PublicEventProvider, PublicEventFetchResult, PublicEventRecord, ProviderOptions } from "./types";

const API_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "CelebrityPass/1.0 (event-discovery)";

async function searchArtistMbid(name: string): Promise<string | null> {
  const url = `${API_BASE}/artist/?query=${encodeURIComponent(name)}&fmt=json&limit=1`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { artists?: { id?: string; name?: string; disambiguation?: string }[] };
  const artist = data.artists?.[0];
  if (!artist?.id) return null;
  return artist.id;
}

async function getArtistEvents(mbid: string): Promise<PublicEventRecord[]> {
  // MusicBrainz exposes events via the "events" relationship in artist detail.
  const url = `${API_BASE}/artist/${mbid}?inc=event-rels&fmt=json`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    relations?: {
      event?: {
        id?: string;
        name?: string;
        time?: string;
        type?: string;
        setlist?: string;
        lifeSpan?: { begin?: string; end?: string };
      };
      type?: string;
      "target-type"?: string;
    }[];
    name?: string;
  };

  const records: PublicEventRecord[] = [];
  const artistName = data.name ?? "";

  for (const rel of data.relations ?? []) {
    // Only performance relationships pointing at an event.
    if (rel["target-type"] !== "event") continue;
    const ev = rel.event;
    if (!ev?.name) continue;

    // The date comes from the event's life-span begin; `time` (HH:mm) is the
    // announced time-of-day. Combine them into a UTC instant.
    const dateStr = ev.lifeSpan?.begin;
    if (!dateStr) continue;
    let startDate: Date;
    if (ev.time && /^\d{1,2}:\d{2}/.test(ev.time)) {
      startDate = new Date(`${dateStr}T${ev.time}:00Z`);
    } else {
      startDate = new Date(`${dateStr}T00:00:00Z`);
    }
    if (isNaN(startDate.getTime())) continue;

    records.push({
      externalId: ev.id ?? null,
      sourceUrl: `https://musicbrainz.org/event/${ev.id}`,
      name: `${artistName} — ${ev.name}`,
      type: ev.type ?? "Concert",
      description: ev.setlist ? `Setlist available` : null,
      venue: null,
      city: null,
      region: null,
      country: null,
      startAt: startDate,
      endAt: ev.lifeSpan?.end ? new Date(ev.lifeSpan.end) : null,
      timezone: null,
      allDay: false,
      officialUrl: `https://musicbrainz.org/event/${ev.id}`,
      ticketUrl: null,
    });
  }

  return records;
}

export const musicbrainzProvider: PublicEventProvider = {
  key: "musicbrainz",
  label: "MusicBrainz — open music database & event discovery",
  requiresCredentials: false,
  credentialEnvVars: [],
  async fetchEvents(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<PublicEventFetchResult> {
    const celebrities = await ctx.prisma.celebrity.findMany({
      where: { isActive: true },
      select: { name: true, slug: true },
    });

    const records: PublicEventRecord[] = [];
    let errors = 0;

    for (const celeb of celebrities) {
      try {
        const mbid = await searchArtistMbid(celeb.name);
        if (!mbid) continue;

        const events = await getArtistEvents(mbid);
        records.push(...events);

        await new Promise((r) => setTimeout(r, 1100)); // MusicBrainz requires 1 req/sec
      } catch {
        errors++;
      }
    }

    const message =
      errors > 0
        ? `Fetched ${records.length} event(s) from MusicBrainz (${errors} lookups failed).`
        : `Fetched ${records.length} event(s) from MusicBrainz.`;
    return { records, message };
  },
};
