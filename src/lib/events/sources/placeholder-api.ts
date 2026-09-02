// Placeholder provider: demonstrates the modular API-source architecture.
//
// This provider is DISABLED by default. It will NOT fabricate any event data.
// To use a real provider, configure credentials in env vars (e.g.
// EVENT_TICKETING_API_KEY) and set the enabled flag in admin. Until then it
// returns an empty, honest result so the app never shows fake events.
//
// You can wire this to any legitimate public event API whose terms permit
// non-commercial use by implementing `fetchEvents`.
import type { PrismaClient } from "@prisma/client";
import type { PublicEventProvider, PublicEventFetchResult, ProviderOptions } from "./types";

function hasKey(options: ProviderOptions): boolean {
  const k = options.credentials?.apiKey;
  return typeof k === "string" && k.length > 0;
}

export const placeholderApiProvider: PublicEventProvider = {
  key: "ticketing-api",
  label: "Official ticketing / events API (connect later)",
  requiresCredentials: true,
  // Secret lives ONLY in env — never in the DB, never in frontend JS.
  credentialEnvVars: ["EVENT_TICKETING_API_KEY"],
  async fetchEvents(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<PublicEventFetchResult> {
    if (!hasKey(ctx.options)) {
      return {
        records: [],
        message:
          "Provider not configured: add EVENT_TICKETING_API_KEY to your environment and enable this source in admin to pull real public event data.",
      };
    }
    // TODO: implement the real public API call here using ctx.options.credentials.apiKey.
    // Return records with externalId + sourceUrl so re-syncs dedupe correctly.
    return { records: [], message: "Configured. Awaiting real provider implementation." };
  },
};
