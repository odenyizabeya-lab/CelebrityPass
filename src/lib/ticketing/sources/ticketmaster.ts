// Ticketmaster ticket inventory provider.
//
// Pulls ticket inventory (price points, availability) from the Ticketmaster
// Discovery API for events that have already been synced into the database.
// Uses the same API key as the event source.
//
// Only real, publicly listed ticket data is stored. Nothing is ever fabricated.
import type { PrismaClient } from "@prisma/client";
import type { TicketProvider, TicketProviderFetchResult, ProviderOptions } from "./types";
import { getTicketmasterApiKey } from "@/lib/events/sources/ticketing-settings";

const API_BASE = "https://app.ticketmaster.com/discovery/v2";

export const ticketmasterTicketProvider: TicketProvider = {
  key: "ticketmaster",
  label: "Ticketmaster — real ticket inventory & pricing",
  requiresCredentials: true,
  credentialEnvVars: ["EVENT_TICKETING_API_KEY"],
  async fetchTicketData(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<TicketProviderFetchResult> {
    const apiKey = await getTicketmasterApiKey();
    if (!apiKey) {
      return {
        payloads: [],
        message:
          "Ticketmaster key not configured. Paste your free API key (developer.ticketmaster.com) in Admin → Event settings.",
      };
    }

    // Find events that have a Ticketmaster source link (external ID).
    const sourceLinks = await ctx.prisma.eventSourceLink.findMany({
      where: {
        source: { key: "ticketmaster" },
        externalId: { not: null },
      },
      include: {
        event: { select: { id: true, eventId: true, name: true, startAt: true } },
      },
      take: 100,
    });

    const payloads: TicketProviderFetchResult["payloads"] = [];
    let errors = 0;

    for (const link of sourceLinks) {
      const tmEventId = link.externalId;
      if (!tmEventId) continue;

      try {
        const url =
          `${API_BASE}/events/${encodeURIComponent(tmEventId)}.json` +
          `?apikey=${encodeURIComponent(apiKey)}&expand=classifications,priceRanges`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });

        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        if (!res.ok) {
          errors++;
          continue;
        }

        const data = (await res.json()) as Record<string, unknown>;
        const priceRanges = (data as { priceRanges?: { type?: string; min?: number; max?: number; currency?: string }[] }).priceRanges ?? [];
        const eventUrl = (data as { url?: string }).url;

        if (priceRanges.length === 0) {
          // No price data available for this event — skip honestly.
          continue;
        }

        const inventory = priceRanges.map((pr, idx) => {
          const typeLabel = pr.type ? pr.type.charAt(0).toUpperCase() + pr.type.slice(1) : "Ticket";
          return {
            externalId: `${tmEventId}-pr-${idx}`,
            name: pr.type === "standard" ? "Standard" : pr.type === "vip" ? "VIP" : typeLabel,
            category: pr.type ?? null,
            priceCents: Math.round((pr.min ?? 0) * 100),
            feesCents: 0, // Ticketmaster doesn't separate fees in discovery API
            currency: pr.currency ?? "USD",
            quantityAvailable: null, // Ticketmaster doesn't disclose exact count in discovery
            quantityTotal: null,
            status: "AVAILABLE" as const,
            url: eventUrl ?? null,
          };
        });

        payloads.push({
          eventExternalId: tmEventId,
          eventName: link.event.name,
          startAt: link.event.startAt,
          inventory,
          officialTicketUrl: eventUrl ?? null,
        });

        await new Promise((r) => setTimeout(r, 150));
      } catch {
        errors++;
      }
    }

    const message =
      errors > 0
        ? `Synced ticket data for ${payloads.length} event(s) (${errors} failed).`
        : `Synced ticket data for ${payloads.length} event(s).`;
    return { payloads, message };
  },
};
