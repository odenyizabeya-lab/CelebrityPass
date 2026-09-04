// Eventbrite public event provider.
//
// Searches the Eventbrite API for events matching each active celebrity's name.
// Requires an Eventbrite private token (free at https://www.eventbrite.com/api/).
// The token is read from the admin-managed AppSetting (with a fallback to the
// EVENTBRITE_TOKEN env var) — never from the browser.
//
// Only publicly announced events are fetched; nothing is ever fabricated.
import type { PrismaClient } from "@prisma/client";
import type { PublicEventProvider, PublicEventFetchResult, PublicEventRecord, ProviderOptions } from "./types";

const API_BASE = "https://www.eventbriteapi.com/v3";

async function getToken(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<string> {
  // Prefer the admin-managed AppSetting over the env var fallback.
  const setting = await ctx.prisma.appSetting.findUnique({ where: { key: "EVENTBRITE_TOKEN" } });
  if (setting?.value) return setting.value;
  return process.env.EVENTBRITE_TOKEN ?? "";
}

function toRecord(ev: {
  id?: string;
  name?: { text?: string };
  url?: string;
  start?: { utc?: string; timezone?: string };
  end?: { utc?: string };
  venue?: { address?: { city?: string; region?: string; country?: string }; name?: string };
  category?: string;
  description?: { text?: string };
  status?: string;
}): PublicEventRecord | null {
  const name = ev.name?.text?.trim();
  if (!name || name.length === 0) return null;

  const startDate = ev.start?.utc ? new Date(ev.start.utc) : null;
  if (!startDate || isNaN(startDate.getTime())) return null;

  return {
    externalId: ev.id ?? null,
    sourceUrl: ev.url ?? null,
    name,
    type: ev.category ?? "Event",
    description: ev.description?.text?.trim()?.slice(0, 500) ?? null,
    venue: ev.venue?.name ?? null,
    city: ev.venue?.address?.city ?? null,
    region: ev.venue?.address?.region ?? null,
    country: ev.venue?.address?.country ?? null,
    startAt: startDate,
    endAt: ev.end?.utc ? new Date(ev.end.utc) : null,
    timezone: ev.start?.timezone ?? null,
    allDay: false,
    officialUrl: ev.url ?? null,
    ticketUrl: ev.url ?? null,
    statusOverride: ev.status === "cancelled" ? "CANCELLED" : ev.status === "deleted" ? "CANCELLED" : null,
  };
}

export const eventbriteProvider: PublicEventProvider = {
  key: "eventbrite",
  label: "Eventbrite — real concerts, conferences & public events",
  requiresCredentials: true,
  credentialEnvVars: ["EVENTBRITE_TOKEN"],
  async fetchEvents(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<PublicEventFetchResult> {
    const token = await getToken(ctx);
    if (!token) {
      return {
        records: [],
        message:
          "Eventbrite token not configured. Add EVENTBRITE_TOKEN to your environment or paste your token in Admin → Event settings.",
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
          `${API_BASE}/events/search/?q=${encodeURIComponent(celeb.name)}` +
          `&expand=venue,category&status=live&page_size=20&order_by=date`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });

        if (res.status === 429) {
          // Rate-limited — back off and skip this celebrity.
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
        await new Promise((r) => setTimeout(r, 200)); // be a good API citizen
      } catch {
        errors++;
      }
    }

    const message =
      errors > 0
        ? `Fetched ${records.length} event record(s) from Eventbrite (${errors} celebrity lookups failed or rate-limited).`
        : `Fetched ${records.length} event record(s) from Eventbrite.`;
    return { records, message };
  },
};
