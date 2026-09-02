/**
 * Admin-managed app settings (e.g. the AI scanner's Gemini API key).
 *
 * The key value is written only server-side and is NEVER returned to the
 * client after it is set — the dashboard only ever sees a boolean "is set"
 * flag. This keeps the credential out of browser-visible responses.
 */

import { prisma } from "@/lib/db";

export const AI_API_KEY_SETTING = "gemini_api_key";

/** True when an AI API key has been saved in settings. */
export async function hasAiApiKey(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: AI_API_KEY_SETTING } });
  return Boolean(row && row.value && row.value.trim().length > 0);
}

/** Read the AI API key for server-side calls. Returns "" when unset. */
export async function getAiApiKey(): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: AI_API_KEY_SETTING } });
  return row?.value ?? "";
}

/** Save (or clear) the AI API key. `key` empty string clears it. */
export async function setAiApiKey(key: string): Promise<void> {
  const value = key.trim();
  if (value.length === 0) {
    await prisma.appSetting.deleteMany({ where: { key: AI_API_KEY_SETTING } });
    return;
  }
  await prisma.appSetting.upsert({
    where: { key: AI_API_KEY_SETTING },
    create: { key: AI_API_KEY_SETTING, value },
    update: { value },
  });
}