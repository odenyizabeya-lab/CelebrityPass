// SeatGeek API event provider.
//
// Pulls real concerts and events from the SeatGeek public API
// (https://api.seatgeek.com/2/). Free client_id registration at
// https://seatgeek.com/build. The client_id is read from the admin-managed
// AppSetting (with a fallback to the SEATGEEK_CLIENT_ID env var) — never
// from the browser.
//
// Only publicly announced events are fetched; nothing is ever fabricated.
import type { PrismaClient } from "@prisma/client";
import type { PublicEventProvider, PublicEventFetchResult, PublicEventRecord, ProviderOptions } from "./types";

const API_BASE = "https://api.seatgeek.com/2";

const SEATGEEK_CLIENT_ID_SETTING = "seatgeek_client_id";

async function getClientId(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<string> {
  const setting = await ctx.prisma.appSetting.findUnique({ where: { key: SEATGEEK_CLIENT_ID_SETTING } });
  if (setting?.value?.trim()) return setting.value.trim();
  return process.env.SEATGEEK_CLIENT_ID?.trim() ?? "";
}

function toRecord(ev: {
  id?: number;
  title?: string;
  url?: string;
  datetime_utc?: string;
  venue?: {
    name?: string;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    extended_address?: string | null;
  };
  performers?: { name?: string; image?: string }[];
  type?: string;
  stats?: { lowest_price?: number | null; median_price?: number | null };
  status?: string;
  description?: string | null;
}): PublicEventRecord | null {
  const name = ev.title?.trim();
  if (!name || name.length === 0) return null;

  const startDate = ev.datetime_utc ? new Date(ev.datetime_utc) : null;
  if (!startDate || isNaN(startDate.getTime())) return null;

  // SeatGeek status "cancelled" / "postponed" maps to our overrides.
  let statusOverride: "POSTPONED" | "CANCELLED" | null = null;
  if (ev.status === "canceled" || ev.status === "cancelled") statusOverride = "CANCELLED";
  if (ev.status === "postponed") statusOverride = "POSTPONED";

  return {
    externalId: ev.id != null ? String(ev.id) : null,
    sourceUrl: ev.url ?? null,
    name,
    type: ev.type ?? "Event",
    description: ev.description?.trim()?.slice(0, 500) ?? null,
    venue: ev.venue?.name ?? null,
    city: ev.venue?.city ?? null,
    region: ev.venue?.state ?? null,
    country: ev.venue?.country ?? null,
    startAt: startDate,
    endAt: null,
    timezone: null,
    allDay: false,
    officialUrl: ev.url ?? null,
    ticketUrl: ev.url ?? null,
    statusOverride,
  };
}

export const seatgeekProvider: PublicEventProvider = {
  key: "seatgeek",
  label: "SeatGeek — real concerts, sports & theatre across the US",
  requiresCredentials: true,
  credentialEnvVars: ["SEATGEEK_CLIENT_ID"],
  async fetchEvents(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<PublicEventFetchResult> {
    const clientId = await getClientId(ctx);
    if (!clientId) {
      return {
        records: [],
        message:
          "SeatGeek client_id not configured. Register free at seatgeek.com/build, then paste your client_id in Admin → Event settings.",
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
        // Search SeatGeek events by performer keyword.
        const url =
          `${API_BASE}/events?performers.slug=${encodeURIComponent(celeb.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}` +
          `&client_id=${encodeURIComponent(clientId)}&per_page=20`;

        const res = await fetch(url, { headers: { Accept: "application/json" } });

        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          errors++;
          continue;
        }
        if (!res.ok) {
          errors++;
          continue;
        }

        const data = (await res.json()) as { events?: unknown[] };
        for (const ev of (data.events ?? []).slice(0, 20)) {
          const rec = toRecord(ev as Parameters<typeof toRecord>[0]);
          if (rec) records.push(rec);
        }
        await new Promise((r) => setTimeout(r, 200)); // rate-limit courtesy
      } catch {
        errors++;
      }
    }

    const message =
      errors > 0
        ? `Fetched ${records.length} event(s) from SeatGeek (${errors} lookups failed or rate-limited).`
        : `Fetched ${records.length} event(s) from SeatGeek.`;
    return { records, message };
  },
};
