// Ticket provider registry — register every available ticket provider here.
import type { TicketProvider } from "./types";
import { ticketmasterTicketProvider } from "./ticketmaster";

export const ticketProviders: TicketProvider[] = [ticketmasterTicketProvider];

export function getTicketProvider(key: string): TicketProvider | undefined {
  return ticketProviders.find((p) => p.key === key);
}

export function getTicketProviderByKeyOrDefault(key: string | null | undefined): TicketProvider | undefined {
  return getTicketProvider(key ?? "");
}
