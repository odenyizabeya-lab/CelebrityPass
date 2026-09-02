// "admin" provider: this source contains public events that an administrator
// manually added/confirmed/edited. It always works with no API key. The sync
// engine treats the admin source as authoritative manual data (never
// overwritten by automated sources, unless the admin re-imports).
import type { PublicEventProvider, PublicEventFetchResult } from "./types";
import { ProviderError } from "./types";

export const adminManualProvider: PublicEventProvider = {
  key: "admin",
  label: "Admin-added public events",
  requiresCredentials: false,
  credentialEnvVars: [],
  async fetchEvents(): Promise<PublicEventFetchResult> {
    // The admin source has no external feed; records are authored directly in
    // the DB. We return an empty result here — the sync engine should skip
    // automated changes for the admin source. This provider exists so that the
    // manual flow is unified and the "source" of a manually-added event is
    // always recorded.
    return { records: [], message: "Manual source — events are entered directly in admin." };
  },
};

export function ensureProviderError(e: unknown): ProviderError {
  return e instanceof ProviderError ? e : new ProviderError(e instanceof Error ? e.message : String(e));
}
