// Provider registry — free providers, plus keyed providers whose key is
// entered in admin (never exposed to the browser).
import type { PublicEventProvider } from "./types";
import { adminManualProvider } from "./admin-manual";
import { musicbrainzProvider } from "./musicbrainz";
import { ticketmasterProvider } from "./ticketmaster";

export const eventProviders: PublicEventProvider[] = [
  adminManualProvider,
  musicbrainzProvider,
  ticketmasterProvider,
];

export function getProvider(key: string): PublicEventProvider | undefined {
  return eventProviders.find((p) => p.key === key);
}

export function getProviderByKeyOrDefault(key: string | null | undefined): PublicEventProvider {
  return getProvider(key ?? "") ?? adminManualProvider;
}
