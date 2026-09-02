// Modular ticket-source contract.
//
// Every authorized ticket provider (official ticketing API, promoter, resale
// platform — anything the business has an authorized relationship with)
// implements `TicketProvider`. The sync engine calls it in the background and
// stores ONLY what the provider reports. Nothing is ever fabricated.
//
// Credentials are read from backend env vars at sync time — never stored in
// the DB and never shipped to the frontend.
import type { PrismaClient } from "@prisma/client";

export type TicketInventoryRecord = {
  externalId?: string | null; // provider's own id for this ticket/price point
  url?: string | null; // provider-authorized deep link to buy this ticket type
  name: string; // e.g. "General Admission"
  category?: string | null; // section / tier, only if the source provides it
  priceCents: number;
  feesCents?: number | null; // fees as reported by the source
  currency?: string;
  quantityAvailable?: number | null; // null = source does not disclose
  quantityTotal?: number | null;
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "NOT_YET_ON_SALE" | "UNAVAILABLE";
  saleStartAt?: string | Date | null;
  saleEndAt?: string | Date | null;
};

export type TicketSyncPayload = {
  // Identifies which event this inventory belongs to. Reliable matching only:
  // externalId (preferred) or exactly matching name + startAt.
  eventExternalId?: string | null;
  eventName: string;
  startAt?: string | Date | null;
  // Optional event-status news from the same authorized source:
  statusOverride?: "POSTPONED" | "CANCELLED" | null;
  rescheduled?: { startAt?: string | Date; endAt?: string | Date | null; note?: string } | null;
  venueChanged?: string | null; // new venue name, when the source reports it
  cityChanged?: string | null;
  officialTicketUrl?: string | null; // authoritative official ticket link
  inventory: TicketInventoryRecord[];
};

export type TicketProviderFetchResult = {
  payloads: TicketSyncPayload[];
  // Message shown in admin "last sync" (never fabricated).
  message?: string;
};

export type ProviderOptions = {
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
};

export interface TicketProvider {
  readonly key: string;
  readonly label: string;
  readonly requiresCredentials: boolean;
  /** Env var names this provider reads for credentials (admin-only metadata). */
  readonly credentialEnvVars: string[];
  fetchTicketData(ctx: { prisma: PrismaClient; options: ProviderOptions }): Promise<TicketProviderFetchResult>;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}