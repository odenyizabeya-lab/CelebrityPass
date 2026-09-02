// Provider registry — register every available event provider here.
import type { PublicEventProvider } from "./types";
import { adminManualProvider } from "./admin-manual";
import { placeholderApiProvider } from "./placeholder-api";

export const eventProviders: PublicEventProvider[] = [
  adminManualProvider,
  placeholderApiProvider,
];

export function getProvider(key: string): PublicEventProvider | undefined {
  return eventProviders.find((p) => p.key === key);
}

export function getProviderByKeyOrDefault(key: string | null | undefined): PublicEventProvider {
  return getProvider(key ?? "") ?? adminManualProvider;
}
