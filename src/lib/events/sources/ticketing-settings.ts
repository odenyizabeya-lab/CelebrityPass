/**
 * Admin-managed Ticketmaster Discovery API key.
 *
 * Stored the same way as the AI scanner key (AppSetting) so an admin can paste
 * it into the dashboard without SSH-ing into the server. The value is written
 * only server-side and is NEVER returned to the browser — the admin UI only
 * sees a boolean "is set" flag.
 *
 * The provider first reads this setting, then falls back to the env var
 * EVENT_TICKETING_API_KEY for installs that prefer env-based config.
 */

import { prisma } from "@/lib/db";

export const TICKETMASTER_API_KEY_SETTING = "ticketmaster_api_key";

/** True when a Ticketmaster key has been saved in settings. */
export async function hasTicketmasterApiKey(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: TICKETMASTER_API_KEY_SETTING } });
  return Boolean(row && row.value && row.value.trim().length > 0);
}

/** Read the Ticketmaster API key (settings first, then env). Returns "" when unset. */
export async function getTicketmasterApiKey(): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: TICKETMASTER_API_KEY_SETTING } });
  if (row?.value?.trim()) return row.value.trim();
  const env = process.env.EVENT_TICKETING_API_KEY;
  return env?.trim() ?? "";
}

/** Save (or clear) the Ticketmaster API key. `key` empty string clears it. */
export async function setTicketmasterApiKey(key: string): Promise<void> {
  const value = key.trim();
  if (value.length === 0) {
    await prisma.appSetting.deleteMany({ where: { key: TICKETMASTER_API_KEY_SETTING } });
    return;
  }
  await prisma.appSetting.upsert({
    where: { key: TICKETMASTER_API_KEY_SETTING },
    create: { key: TICKETMASTER_API_KEY_SETTING, value },
    update: { value },
  });
}