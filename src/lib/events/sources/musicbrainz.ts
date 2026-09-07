// MusicBrainz API event provider.
//
// Pulls artist information and event data from the MusicBrainz API
// (https://musicbrainz.org/doc/MusicBrainz_API).
// MusicBrainz is free and open — no API key required for read access.
// We use it to enrich artist data and discover events via the
// "musicbrainz.org" linked events (when available).
//
// Only publicly announced events are fetched; nothing is ever fabricated.
// NOTE: MusicBrainz event coverage is community-maintained and mostly
// historical — it is a discovery/history source, not a live ticket feed.
import type { PrismaClient } from "@prisma/client";
import type { PublicEventProvider, PublicEventFetchResult, PublicEventRecord, ProviderOptions } from "./types";
import { isEventType } from "../types";

const API_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "CelebrityPass/1.0 (event-discovery)";

// Keep events that start inside this window (recent past → upcoming). The
// sync engine derives COMPLETED/current status from dates; going further
// back would only flood the DB with stale history.
const RECENT_LOOKBACK_MS = 93 * 24 * 3600 * 1000; // ~3 months
const UPCOMING_HORIZON_MS = 18 * 30 * 24 * 3600 * 1000; // ~18 months
const MAX_PER_ARTIST = 100;

type MusicBrainzEvent = {
  id?: string;
  name?: string;
  time?: string;
  type?: string;
  setlist?: string;
  disambiguation?: string;
  cancelled?: boolean;
  "life-span"?: { begin?: string; end?: string; ended?: boolean };
};

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

/** Combine a "YYYY-MM-DD" begin date with an announced "HH:mm(:ss)" time. */
function parseEventStart(dateStr: string, time: string): Date | null {
  let timePart = "00:00:00";
  if (time && /^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) {
    timePart = time.length === 5 ? `${time}:00` : time;
  }
  const d = new Date(`${dateStr}T${timePart}Z`);
  return isNaN(d.getTime()) ? null : d;
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
    relations?: { "target-type"?: string; event?: MusicBrainzEvent }[];
    name?: string;
  };

  const records: PublicEventRecord[] = [];
  const artistName = data.name ?? "";
  const now = Date.now();
  const minBegin = now - RECENT_LOOKBACK_MS;
  const maxBegin = now + UPCOMING_HORIZON_MS;

  for (const rel of data.relations ?? []) {
    // Only performance relationships pointing at an event.
    if (rel["target-type"] !== "event") continue;
    const ev = rel.event;
    if (!ev) continue;

    // The date lives under the "life-span" key (hyphenated). `time` (HH:mm)
    // is the announced time-of-day. Combine them into a UTC instant.
    const dateStr = ev["life-span"]?.begin;
    if (!dateStr) continue;
    const startAt = parseEventStart(dateStr, ev.time ?? "");
    if (!startAt) continue;
    // Skip stale/too-far history and anything beyond the upcoming horizon.
    if (startAt.getTime() < minBegin || startAt.getTime() > maxBegin) continue;

    const title = ev.name ?? "Concert";
    const label = ev.disambiguation ? `${title} (${ev.disambiguation})` : title;
    const name = artistName ? `${artistName} — ${label}` : label;

    records.push({
      externalId: ev.id ?? null,
      sourceUrl: `https://musicbrainz.org/event/${ev.id}`,
      name,
      type: ev.type && isEventType(ev.type) ? ev.type : "Other",
      description: ev.setlist ? "Setlist noted on MusicBrainz." : null,
      venue: null,
      city: null,
      region: null,
      country: null,
      startAt,
      endAt: ev["life-span"]?.end ? new Date(`${ev["life-span"].end}T00:00:00Z`) : null,
      timezone: null,
      allDay: false,
      officialUrl: `https://musicbrainz.org/event/${ev.id}`,
      ticketUrl: null,
      statusOverride: ev.cancelled ? "CANCELLED" : null,
    });
  }

  // Soonest first, capped so one artist can never flood the feed.
  records.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return records.slice(0, MAX_PER_ARTIST);
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
