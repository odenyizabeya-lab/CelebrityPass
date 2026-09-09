// AI settings store for the Automatic Celebrity Scanner.
//
// Stored in the existing AppSetting table (key/value) exactly like the other
// admin-managed keys in this project (admin account, provider API keys). The
// values are server-side only and are NEVER returned to the browser — the
// dashboard reads booleans + a masked last-4 only.
//
// Gemini is the only AI provider the scanner uses. Two key slots (primary +
// backup) give an automatic fallback chain: primary key -> backup key ->
// GEMINI_API_KEY / GEMINI_BACKUP_API_KEY env vars.
import { prisma } from "@/lib/db";

export const AI_PROVIDER_NAME = "Gemini";
export const AI_SETTING_MODEL = "ai.gemini.model";
export const AI_SETTING_PRIMARY_KEY = "ai.gemini.primary_key";
export const AI_SETTING_BACKUP_KEY = "ai.gemini.backup_key";

export const DEFAULT_AI_MODEL = "gemini-2.5-flash";
export const AI_MODEL_OPTIONS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"] as const;

async function getSetting(key: string): Promise<string> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    return row?.value?.trim() ?? "";
  } catch {
    return "";
  }
}

async function setSetting(key: string, value: string): Promise<void> {
  const v = value.trim();
  if (!v) {
    await prisma.appSetting.deleteMany({ where: { key } });
    return;
  }
  await prisma.appSetting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
}

/** Gemini model id used for scanning (settings -> GEMINI_MODEL env -> default). */
export async function getAIModel(): Promise<string> {
  const fromDb = await getSetting(AI_SETTING_MODEL);
  return fromDb || process.env.GEMINI_MODEL?.trim() || DEFAULT_AI_MODEL;
}

export async function setAIModel(model: string): Promise<void> {
  const safe = model.trim();
  await setSetting(AI_SETTING_MODEL, AI_MODEL_OPTIONS.includes(safe as (typeof AI_MODEL_OPTIONS)[number]) ? safe : DEFAULT_AI_MODEL);
}

/** Configured Gemini keys (settings first, env fallback). Empty string = unset. */
export async function getGeminiKeys(): Promise<{ primary: string; backup: string }> {
  try {
    const [primary, backup] = await Promise.all([getSetting(AI_SETTING_PRIMARY_KEY), getSetting(AI_SETTING_BACKUP_KEY)]);
    return {
      primary: primary || process.env.GEMINI_API_KEY?.trim() || "",
      backup: backup || process.env.GEMINI_BACKUP_API_KEY?.trim() || "",
    };
  } catch {
    return { primary: process.env.GEMINI_API_KEY?.trim() ?? "", backup: process.env.GEMINI_BACKUP_API_KEY?.trim() ?? "" };
  }
}

/** Save (or clear) one Gemini key slot. Empty string clears it. */
export async function setGeminiKey(slot: "primary" | "backup", value: string): Promise<void> {
  await setSetting(slot === "primary" ? AI_SETTING_PRIMARY_KEY : AI_SETTING_BACKUP_KEY, value);
}

/** Mask a secret for display: "AB12••••wxyz" / "••••" when short. */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "•".repeat(Math.min(6, trimmed.length));
  return `${trimmed.slice(0, 4)}${"•".repeat(6)}${trimmed.slice(-4)}`;
}

export type AiSettingsStatus = {
  provider: string;
  model: string;
  modelOptions: readonly string[];
  primaryConfigured: boolean;
  backupConfigured: boolean;
  primaryLast4: string;
  backupLast4: string;
};

/** Masked, client-safe summary of the current AI configuration. */
export async function getAiSettingsStatus(): Promise<AiSettingsStatus> {
  const keys = await getGeminiKeys();
  const model = await getAIModel();
  return {
    provider: AI_PROVIDER_NAME,
    model,
    modelOptions: AI_MODEL_OPTIONS,
    primaryConfigured: Boolean(keys.primary),
    backupConfigured: Boolean(keys.backup),
    primaryLast4: maskSecret(keys.primary),
    backupLast4: maskSecret(keys.backup),
  };
}