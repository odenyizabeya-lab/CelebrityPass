// Generic provider settings helper.
//
// Admin-managed API keys for event providers are stored in AppSetting.
// Each provider reads its key from AppSetting first, then falls back
// to the environment variable. Keys are never returned to the browser.
import { prisma } from "@/lib/db";

export type ProviderKeyConfig = {
  settingKey: string;
  envVar: string;
  label: string;
};

export const PROVIDER_KEY_CONFIGS: Record<string, ProviderKeyConfig> = {
  ticketmaster: { settingKey: "ticketmaster_api_key", envVar: "EVENT_TICKETING_API_KEY", label: "Ticketmaster" },
  eventbrite: { settingKey: "EVENTBRITE_TOKEN", envVar: "EVENTBRITE_TOKEN", label: "Eventbrite" },
  bandsintown: { settingKey: "bandsintown_app_id", envVar: "BANDSINTOWN_APP_ID", label: "Bandsintown" },
  setlistfm: { settingKey: "setlistfm_api_key", envVar: "SETLISTFM_API_KEY", label: "setlist.fm" },
  seatgeek: { settingKey: "seatgeek_client_id", envVar: "SEATGEEK_CLIENT_ID", label: "SeatGeek" },
};

/** Check if a provider's API key is configured (settings or env). */
export async function hasProviderKey(providerKey: string): Promise<boolean> {
  const config = PROVIDER_KEY_CONFIGS[providerKey];
  if (!config) return false;
  const row = await prisma.appSetting.findUnique({ where: { key: config.settingKey } });
  if (row?.value?.trim()) return true;
  return Boolean(process.env[config.envVar]?.trim());
}

/** Read a provider's API key (settings first, then env). Returns "" when unset. */
export async function getProviderKey(providerKey: string): Promise<string> {
  const config = PROVIDER_KEY_CONFIGS[providerKey];
  if (!config) return "";
  const row = await prisma.appSetting.findUnique({ where: { key: config.settingKey } });
  if (row?.value?.trim()) return row.value.trim();
  return process.env[config.envVar]?.trim() ?? "";
}

/** Save (or clear) a provider's API key. Empty string clears it. */
export async function setProviderKey(providerKey: string, key: string): Promise<void> {
  const config = PROVIDER_KEY_CONFIGS[providerKey];
  if (!config) return;
  const value = key.trim();
  if (value.length === 0) {
    await prisma.appSetting.deleteMany({ where: { key: config.settingKey } });
    return;
  }
  await prisma.appSetting.upsert({
    where: { key: config.settingKey },
    create: { key: config.settingKey, value },
    update: { value },
  });
}

/** Test a provider's API connection by attempting to read the key and make a lightweight request. */
export async function testProviderConnection(providerKey: string): Promise<{ ok: boolean; message: string }> {
  const key = await getProviderKey(providerKey);
  if (!key && providerKey !== "musicbrainz") {
    return { ok: false, message: `No API key configured for ${PROVIDER_KEY_CONFIGS[providerKey]?.label ?? providerKey}.` };
  }

  try {
    switch (providerKey) {
      case "musicbrainz": {
        const res = await fetch("https://musicbrainz.org/ws/2/artist/?query=Metallica&fmt=json&limit=1", {
          headers: { Accept: "application/json", "User-Agent": "CelebrityPass/1.0 (connection-test)" },
        });
        if (res.ok) return { ok: true, message: "MusicBrainz API connection successful (free, no key required)." };
        return { ok: false, message: `MusicBrainz API returned status ${res.status}.` };
      }
      case "ticketmaster": {
        const res = await fetch(
          `https://app.ticketmaster.com/discovery/v2/events.json?keyword=test&apikey=${encodeURIComponent(key)}&size=1`,
          { headers: { Accept: "application/json" } },
        );
        if (res.ok) return { ok: true, message: "Ticketmaster API connection successful." };
        if (res.status === 401 || res.status === 403) return { ok: false, message: "Ticketmaster API key is invalid or expired." };
        return { ok: false, message: `Ticketmaster API returned status ${res.status}.` };
      }
      case "bandsintown": {
        const res = await fetch(
          `https://rest.bandsintown.com/artists/Metallica?app_id=${encodeURIComponent(key)}`,
          { headers: { Accept: "application/json" } },
        );
        if (res.ok) return { ok: true, message: "Bandsintown API connection successful." };
        if (res.status === 401 || res.status === 403) return { ok: false, message: "Bandsintown app_id is invalid." };
        return { ok: false, message: `Bandsintown API returned status ${res.status}.` };
      }
      case "setlistfm": {
        const res = await fetch("https://api.setlist.fm/rest/1.0/search/artists?artistName=Metallica&p=1", {
          headers: { "x-api-key": key, Accept: "application/json" },
        });
        if (res.ok) return { ok: true, message: "setlist.fm API connection successful." };
        if (res.status === 401 || res.status === 403) return { ok: false, message: "setlist.fm API key is invalid." };
        return { ok: false, message: `setlist.fm API returned status ${res.status}.` };
      }
      case "lastfm":
      case "seatgeek": {
        const res = await fetch(
          `https://api.seatgeek.com/2/events?q=test&client_id=${encodeURIComponent(key)}&per_page=1`,
          { headers: { Accept: "application/json" } },
        );
        if (res.ok) return { ok: true, message: "SeatGeek API connection successful." };
        if (res.status === 401 || res.status === 403) return { ok: false, message: "SeatGeek client_id is invalid." };
        return { ok: false, message: `SeatGeek API returned status ${res.status}.` };
      }
      case "eventbrite": {
        const res = await fetch("https://www.eventbriteapi.com/v3/events/search/?q=test&page_size=1", {
          headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        });
        if (res.ok) return { ok: true, message: "Eventbrite API connection successful." };
        if (res.status === 401 || res.status === 403) return { ok: false, message: "Eventbrite token is invalid." };
        return { ok: false, message: `Eventbrite API returned status ${res.status}.` };
      }
      default:
        return { ok: false, message: `Unknown provider: ${providerKey}` };
    }
  } catch (e) {
    return { ok: false, message: `Connection test failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
