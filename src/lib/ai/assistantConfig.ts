// AI Reply Assistant settings store.
//
// Backed by the AppSetting table (key/value) exactly like the scanner keys, so
// the owner can paste a (free) Gemini key in Admin → AI Settings and swap it
// any time — no env edits, no redeploys; the already-running site picks up the
// new key on the next fan message. Env vars remain as fallbacks:
//
//   ASSIST_GEMINI_KEY        database first, then this env var, then unset
//   ASSIST_GEMINI_MODEL      default "gemini-2.5-flash"
//   ASSIST_GEMINI_BASE_URL   default https://generativelanguage.googleapis.com/v1beta
//
// Keys are server-side only and NEVER returned to the browser (the dashboard
// only sees a masked hint). Stored values are encrypted with AES-256-GCM when
// AI_KEY_ENCRYPTION_KEY (or SOCIAL_TOKEN_ENCRYPTION_KEY) is set.
import { prisma } from "@/lib/db";
import {
  encryptStoredKey,
  decryptStoredKey,
  decryptionKey,
  maskSecret,
} from "@/lib/ai/settings";

export const ASSIST_SETTING_KEY = "assistant.gemini.key";
export const ASSIST_SETTING_MODEL = "assistant.gemini.model";
export const ASSIST_SETTING_BASE_URL = "assistant.gemini.base_url";
export const ASSISTANT_DEFAULT_MODEL = "gemini-2.5-flash";
export const ASSISTANT_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

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

export type ConfigSource = "db" | "env" | "";

export type AssistantConfig = {
  key: string;
  model: string;
  baseUrl: string;
  keySource: ConfigSource;
  modelSource: ConfigSource;
  baseUrlSource: ConfigSource;
};

/** Resolved assistant config: database first, env fallback, then defaults. */
export async function getAssistantConfig(): Promise<AssistantConfig> {
  const envKey = process.env.ASSIST_GEMINI_KEY?.trim() ?? "";
  const envModel = process.env.ASSIST_GEMINI_MODEL?.trim() ?? "";
  const envBase = process.env.ASSIST_GEMINI_BASE_URL?.trim() ?? "";
  try {
    const [storedKey, storedModel, storedBase] = await Promise.all([
      getSetting(ASSIST_SETTING_KEY),
      getSetting(ASSIST_SETTING_MODEL),
      getSetting(ASSIST_SETTING_BASE_URL),
    ]);
    const key = decryptStoredKey(storedKey);
    // Migrate legacy plaintext rows to encrypted form once an encryption key is available.
    if (key && !storedKey.startsWith("enc1.") && decryptionKey()) {
      await setSetting(ASSIST_SETTING_KEY, encryptStoredKey(key));
    }
    return {
      key: key || envKey,
      model: (storedModel || envModel || ASSISTANT_DEFAULT_MODEL).trim(),
      baseUrl: ((storedBase || envBase || ASSISTANT_DEFAULT_BASE_URL).trim()).replace(/\/+$/, ""),
      keySource: key ? "db" : envKey ? "env" : "",
      modelSource: storedModel ? "db" : envModel ? "env" : "",
      baseUrlSource: storedBase ? "db" : envBase ? "env" : "",
    };
  } catch {
    return {
      key: envKey,
      model: envModel || ASSISTANT_DEFAULT_MODEL,
      baseUrl: (envBase || ASSISTANT_DEFAULT_BASE_URL).replace(/\/+$/, ""),
      keySource: envKey ? "env" : "",
      modelSource: envModel ? "env" : "",
      baseUrlSource: envBase ? "env" : "",
    };
  }
}

/** Save (or clear, with an empty string) the assistant's Gemini key. */
export async function setAssistantKey(value: string): Promise<void> {
  const v = value.trim();
  await setSetting(ASSIST_SETTING_KEY, v ? encryptStoredKey(v) : "");
}

export async function setAssistantModel(value: string): Promise<void> {
  await setSetting(ASSIST_SETTING_MODEL, value.trim());
}

export async function setAssistantBaseUrl(value: string): Promise<void> {
  await setSetting(ASSIST_SETTING_BASE_URL, value.trim());
}

export type AssistantStatus = {
  keyConfigured: boolean;
  keyLast4: string;
  keySource: ConfigSource;
  model: string;
  modelSource: ConfigSource;
  baseUrl: string;
  baseUrlSource: ConfigSource;
  encryptionEnabled: boolean;
  defaultModel: string;
};

/** Masked, client-safe summary of the current assistant configuration. */
export async function getAssistantStatus(): Promise<AssistantStatus> {
  const cfg = await getAssistantConfig();
  return {
    keyConfigured: Boolean(cfg.key),
    keyLast4: maskSecret(cfg.key),
    keySource: cfg.keySource,
    model: cfg.model,
    modelSource: cfg.modelSource,
    baseUrl: cfg.baseUrl,
    baseUrlSource: cfg.baseUrlSource,
    encryptionEnabled: Boolean(decryptionKey()),
    defaultModel: ASSISTANT_DEFAULT_MODEL,
  };
}