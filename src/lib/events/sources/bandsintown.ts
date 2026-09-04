// Bandsintown API event provider.
//
// Pulls upcoming concerts from the Bandsintown API (https://www.bandsintown.com/api).
// Requires a free "app_id" registered at bandsintown.com/for-artists/api.
// The app_id is read from the admin-managed AppSetting (with a fallback to the
// BANDSINTOWN_APP_ID env var) — never from the browser.
//
// Only publicly announced events are fetched; nothing is ever fabricated.
import type { PrismaClient } from "@prisma/client";
import type { PublicEventProvider, PublicEventFetchResult, PublicEventRecord, ProviderOptions } from "./types";

const API_BASE = "https://rest.bandsintown.com";

const BANDSINTOWN_APP_ID_SETTING = "bandsintown_app_id";

async function getAppId(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<string> {
  const setting = await ctx.prisma.appSetting.findUnique({ where: { key: BANDSINTOWN_APP_ID_SETTING } });
  if (setting?.value?.trim()) return setting.value.trim();
  return process.env.BANDSINTOWN_APP_ID?.trim() ?? "";
}

function toRecord(ev: {
  id?: string;
  title?: string;
  datetime?: string;
  url?: string;
  venue?: {
    name?: string;
    city?: string;
    region?: string;
    country?: string;
    longitude?: number;
    latitude?: number;
  };
  lineup?: { name?: string }[];
  offers?: { type?: string; url?: string; status?: string; price?: string }[];
  description?: string;
}): PublicEventRecord | null {
  const name = ev.title?.trim();
  if (!name || name.length === 0) return null;

  const startDate = ev.datetime ? new Date(ev.datetime) : null;
  if (!startDate || isNaN(startDate.getTime())) return null;

  const ticketOffer = ev.offers?.find((o) => o.type === "Tickets");
  const ticketUrl = ticketOffer?.url ?? ev.url ?? null;

  return {
    externalId: ev.id ?? null,
    sourceUrl: ev.url ?? null,
    name,
    type: "Concert",
    description: ev.description?.trim()?.slice(0, 500) ?? null,
    venue: ev.venue?.name ?? null,
    city: ev.venue?.city ?? null,
    region: ev.venue?.region ?? null,
    country: ev.venue?.country ?? null,
    startAt: startDate,
    endAt: null,
    timezone: null,
    allDay: false,
    officialUrl: ev.url ?? null,
    ticketUrl,
  };
}

export const bandsintownProvider: PublicEventProvider = {
  key: "bandsintown",
  label: "Bandsintown — real concerts & live music events",
  requiresCredentials: true,
  credentialEnvVars: ["BANDSINTOWN_APP_ID"],
  async fetchEvents(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<PublicEventFetchResult> {
    const appId = await getAppId(ctx);
    if (!appId) {
      return {
        records: [],
        message:
          "Bandsintown app_id not configured. Register free at bandsintown.com/for-artists/api, then paste your app_id in Admin → Event settings.",
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
        const encodedName = encodeURIComponent(celeb.name);
        const url = `${API_BASE}/artists/${encodedName}/events?app_id=${encodeURIComponent(appId)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });

        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          errors++;
          continue;
        }
        if (res.status === 404) {
          // Artist not found on Bandsintown — not an error, just no data.
          continue;
        }
        if (!res.ok) {
          errors++;
          continue;
        }

        const data = (await res.json()) as unknown[];
        if (!Array.isArray(data)) {
          errors++;
          continue;
        }

        for (const ev of data.slice(0, 20)) {
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
        ? `Fetched ${records.length} event(s) from Bandsintown (${errors} lookups failed or rate-limited).`
        : `Fetched ${records.length} event(s) from Bandsintown.`;
    return { records, message };
  },
};
