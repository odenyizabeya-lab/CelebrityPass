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

// No external API providers configured. All event/ticket management is
// handled internally via the admin panel and built-in free registration.
export const PROVIDER_KEY_CONFIGS: Record<string, ProviderKeyConfig> = {
  ticketmaster: {
    settingKey: "ticketmaster_api_key",
    envVar: "EVENT_TICKETING_API_KEY",
    label: "Ticketmaster Discovery API",
  },
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
        if (!key) return { ok: false, message: "No Ticketmaster API key configured yet." };
        const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?apikey=${encodeURIComponent(key)}&size=1&includeTest=no`, {
          headers: { Accept: "application/json" },
        });
        if (res.ok) return { ok: true, message: "Ticketmaster API connection successful — key is valid." };
        if (res.status === 401 || res.status === 403) return { ok: false, message: "Ticketmaster rejected the key (401/403). Double-check the key." };
        return { ok: false, message: `Ticketmaster API returned status ${res.status}.` };
      }
      case "manual":
        return { ok: true, message: "Manual events require no API key — added directly through the admin panel." };
      default:
        return { ok: false, message: `Unknown provider: ${providerKey}` };
    }
  } catch (e) {
    return { ok: false, message: `Connection test failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
