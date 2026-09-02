// Modular public-event source system.
//
// Each provider implements the PublicEventProvider interface. Sources are
// registered in the registry by key and can be enabled/configured in admin
// without changing app code. Providers NEVER require (or handle) secrets in
// the frontend — credentials are read from backend env vars at sync time.
//
// Only publicly announced event information is used.
import type { PrismaClient } from "@prisma/client";

export type PublicEventRecord = {
  // Machine id / external id as given by the provider (used for matching).
  externalId?: string | null;
  sourceUrl?: string | null;
  name: string;
  type: string;
  description?: string | null;
  venue?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  // startAt/endAt are UTC instants. timezone is the IANA venue timezone name.
  startAt: string | Date;
  endAt?: string | Date | null;
  timezone?: string | null;
  allDay?: boolean;
  officialUrl?: string | null;
  ticketUrl?: string | null;
  // Only set when the provider explicitly announces a postponement/cancellation.
  statusOverride?: "POSTPONED" | "CANCELLED" | null;
};

export type PublicEventFetchResult = {
  records: PublicEventRecord[];
  // optional message for the lastSyncMessage field.
  message?: string;
};

export type ProviderOptions = {
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
};

/**
 * Contract every event provider implements. `fetchEvents` returns publicly
 * announced events for all known celebrities; the sync engine matches each
 * record back to a celebrity via its `celebrityKey`.
 */
export interface PublicEventProvider {
  readonly key: string;
  readonly label: string;
  /** True if this provider needs credentials from env. */
  readonly requiresCredentials: boolean;
  /** Env var names this provider reads for credentials (admin-only metadata). */
  readonly credentialEnvVars: string[];
  /** Fetch current public events. Throws a ProviderError on failure. */
  fetchEvents(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<PublicEventFetchResult>;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
