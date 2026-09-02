// Placeholder ticket provider: demonstrates the modular source architecture.
//
// It is DISABLED by default and NEVER fabricates inventory. Until real
// credentials are configured it returns an empty, honest result so the app
// never shows fake prices or fake availability.
// Wire any legitimate authorized provider here later (official ticketing API,
// promoter feed, resale platform API) by implementing `fetchTicketData`.
import type { PrismaClient } from "@prisma/client";
import type { TicketProvider, TicketProviderFetchResult, ProviderOptions } from "./types";

function hasKey(options: ProviderOptions): boolean {
  const k = options.credentials?.apiKey;
  return typeof k === "string" && k.length > 0;
}

export const placeholderTicketingProvider: TicketProvider = {
  key: "ticketing-api",
  label: "Official ticketing API (connect later)",
  requiresCredentials: true,
  credentialEnvVars: ["EVENT_TICKETING_API_KEY"],
  async fetchTicketData(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<TicketProviderFetchResult> {
    if (!hasKey(ctx.options)) {
      return {
        payloads: [],
        message:
          "Ticket source not configured: add EVENT_TICKETING_API_KEY to your environment and enable this source in admin to pull real ticket inventory.",
      };
    }
    // TODO: implement the real authorized call here.
    return { payloads: [], message: "Configured. Awaiting real provider implementation." };
  },
};