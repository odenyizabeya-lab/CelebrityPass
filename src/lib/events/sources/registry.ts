// Provider registry — register every available event provider here.
import type { PublicEventProvider } from "./types";
import { adminManualProvider } from "./admin-manual";
import { eventbriteProvider } from "./placeholder-api";
import { ticketmasterProvider } from "./ticketmaster";
import { bandsintownProvider } from "./bandsintown";
import { setlistFmProvider } from "./setlistfm";
import { musicbrainzProvider } from "./musicbrainz";
import { seatgeekProvider } from "./seatgeek";

export const eventProviders: PublicEventProvider[] = [
  adminManualProvider,
  ticketmasterProvider,
  eventbriteProvider,
  bandsintownProvider,
  setlistFmProvider,
  musicbrainzProvider,
  seatgeekProvider,
];

export function getProvider(key: string): PublicEventProvider | undefined {
  return eventProviders.find((p) => p.key === key);
}

export function getProviderByKeyOrDefault(key: string | null | undefined): PublicEventProvider {
  return getProvider(key ?? "") ?? adminManualProvider;
}
