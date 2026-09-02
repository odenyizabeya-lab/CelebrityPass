// Ticket provider registry — register every available ticket provider here.
import type { TicketProvider } from "./types";
import { placeholderTicketingProvider } from "./placeholder";

export const ticketProviders: TicketProvider[] = [placeholderTicketingProvider];

export function getTicketProvider(key: string): TicketProvider | undefined {
  return ticketProviders.find((p) => p.key === key);
}

export function getTicketProviderByKeyOrDefault(key: string | null | undefined): TicketProvider | undefined {
  return getTicketProvider(key ?? "");
}