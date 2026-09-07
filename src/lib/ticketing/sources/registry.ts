// Ticket provider registry — register every available ticket provider here.
import type { TicketProvider } from "./types";

// No external ticket providers. Ticket inventory is managed manually by admins
// or via the built-in free registration system with QR tickets.
export const ticketProviders: TicketProvider[] = [];

export function getTicketProvider(key: string): TicketProvider | undefined {
  return ticketProviders.find((p) => p.key === key);
}

export function getTicketProviderByKeyOrDefault(key: string | null | undefined): TicketProvider | undefined {
  return getTicketProvider(key ?? "");
}
