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
//
// Security model: keys are NEVER returned to the browser (only booleans and a
// masked suffix), never logged, and never included in error messages. The
// recommended setup is to set GEMINI_API_KEY / GEMINI_BACKUP_API_KEY in the
// server environment — no key then touches the database at all. Keys saved via
// the admin form are stored at rest in the AppSetting table; when
// AI_KEY_ENCRYPTION_KEY (or SOCIAL_TOKEN_ENCRYPTION_KEY) is set, they are
// encrypted with AES-256-GCM before being persisted. Without an encryption key
// they are stored server-side only, unchanged, which is why the dashboard shows
// an "encryption off" hint.
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const AI_PROVIDER_NAME = "Gemini";
export const AI_SETTING_MODEL = "ai.gemini.model";
export const AI_SETTING_PRIMARY_KEY = "ai.gemini.primary_key";
export const AI_SETTING_BACKUP_KEY = "ai.gemini.backup_key";

const ENC_PREFIX = "enc1.";
const ENC_PREFIX_START = "enc1.";

/** Encryption secret for at-rest AI keys; falls back to the social-token one. */
export function decryptionKey(): string {
  return process.env.AI_KEY_ENCRYPTION_KEY?.trim() || process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim() || "";
}

export function encryptStoredKey(plain: string): string {
  const secret = decryptionKey();
  if (!secret || !plain) return plain;
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("hex")}.${tag.toString("hex")}.${enc.toString("hex")}`;
}

/** Decrypt an `enc1.`-prefixed stored key. Legacy plaintext passes through. */
export function decryptStoredKey(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX_START)) return stored;
  const secret = decryptionKey();
  if (!secret) return ""; // encrypted at rest but the decryption key is missing — fail closed
  const body = stored.slice(ENC_PREFIX_START.length);
  const [ivHex, tagHex, ...rest] = body.split(".");
  const dataHex = rest.join(".");
  if (!ivHex || !tagHex || !dataHex) return stored;
  try {
    const key = crypto.createHash("sha256").update(secret).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export const DEFAULT_AI_MODEL = "gemini-3.6-flash";
// Live catalog for this key (verified via listModels, 2026-09). Older
// gemini-2.x flash models are retired for new users and handled by
// DEPRECATED_MODELS below.
export const AI_MODEL_OPTIONS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
] as const;

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

const DEPRECATED_MODELS: Record<string, string> = {
  "gemini-2.5-flash": "gemini-3.6-flash",
  "gemini-2.0-flash": "gemini-3.6-flash",
};

/** Gemini model id used for scanning (settings -> GEMINI_MODEL env -> default). */
export async function getAIModel(): Promise<string> {
  const fromDb = await getSetting(AI_SETTING_MODEL);
  const raw = fromDb || process.env.GEMINI_MODEL?.trim() || DEFAULT_AI_MODEL;
  const migrated = DEPRECATED_MODELS[raw];
  if (migrated) {
    await setAIModel(migrated);
    return migrated;
  }
  return raw;
}

export async function setAIModel(model: string): Promise<void> {
  const safe = model.trim();
  await setSetting(AI_SETTING_MODEL, AI_MODEL_OPTIONS.includes(safe as (typeof AI_MODEL_OPTIONS)[number]) ? safe : DEFAULT_AI_MODEL);
}

/** Configured Gemini keys (settings first, env fallback). Empty string = unset. */
export type GeminiKeySource = "db" | "env" | "";

export type GeminiKeys = {
  primary: string;
  backup: string;
  primarySource: GeminiKeySource;
  backupSource: GeminiKeySource;
};

export async function getGeminiKeys(): Promise<GeminiKeys> {
  const envPrimary = process.env.GEMINI_API_KEY?.trim() ?? "";
  const envBackup = process.env.GEMINI_BACKUP_API_KEY?.trim() ?? "";
  try {
    const [storedPrimary, storedBackup] = await Promise.all([
      getSetting(AI_SETTING_PRIMARY_KEY),
      getSetting(AI_SETTING_BACKUP_KEY),
    ]);
    const primary = decryptStoredKey(storedPrimary);
    const backup = decryptStoredKey(storedBackup);
    // Migrate legacy plaintext rows to encrypted form once an encryption key is available.
    if (primary && !storedPrimary.startsWith(ENC_PREFIX) && decryptionKey()) {
      await setSetting(AI_SETTING_PRIMARY_KEY, encryptStoredKey(primary));
    }
    if (backup && !storedBackup.startsWith(ENC_PREFIX) && decryptionKey()) {
      await setSetting(AI_SETTING_BACKUP_KEY, encryptStoredKey(backup));
    }
    return {
      primary: primary || envPrimary,
      backup: backup || envBackup,
      primarySource: primary ? "db" : envPrimary ? "env" : "",
      backupSource: backup ? "db" : envBackup ? "env" : "",
    };
  } catch {
    return {
      primary: envPrimary,
      backup: envBackup,
      primarySource: envPrimary ? "env" : "",
      backupSource: envBackup ? "env" : "",
    };
  }
}

/** Save (or clear) one Gemini key slot. Empty string clears it. */
export async function setGeminiKey(slot: "primary" | "backup", value: string): Promise<void> {
  const v = value.trim();
  await setSetting(
    slot === "primary" ? AI_SETTING_PRIMARY_KEY : AI_SETTING_BACKUP_KEY,
    v ? encryptStoredKey(v) : "",
  );
  clearGeminiHealthCache();
}

/**
 * Coarse sanity check that a value looks like a Google AI Studio key. This is a
 * format check only (we do NOT claim the key is invalid here). Gemini keys
 * either start with "AIza" (~39 chars) or "AQ." (~60 chars).
 */
export function isPlausibleGeminiKey(key: string): boolean {
  const t = key.trim();
  return /^AIza[0-9A-Za-z_-]{30,45}$/.test(t) || /^AQ\.[0-9A-Za-z_-]{40,80}$/.test(t);
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
  primarySource: GeminiKeySource;
  backupSource: GeminiKeySource;
  encryptionEnabled: boolean;
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
    primarySource: keys.primarySource,
    backupSource: keys.backupSource,
    encryptionEnabled: Boolean(decryptionKey()),
  };
}

export type GeminiKeyHealth = {
  slot: "primary" | "backup" | "envPrimary" | "envBackup";
  label: string;
  source: GeminiKeySource;
  /** Masked hint (never the key itself). */
  last4: string;
  configured: boolean;
  result: { ok: boolean; kind: string; message?: string } | null;
};

export type GeminiKeyHealthEntry = GeminiKeyHealth & { key: string };

const HEALTH_TTL_MS = 60_000;
let healthCache: { at: number; entries: GeminiKeyHealthEntry[] } | null = null;

/**
 * Live health of every configured Gemini key, probed with a tiny real
 * generation (listModels alone passes for keys whose project Google has denied,
 * so the probe reproduces an actual call). Cached briefly so the settings page
 * and a burst of scans share one probe instead of hammering Gemini.
 * The raw key values stay server-side — callers must strip them before sending
 * anything to the browser.
 */
export async function getGeminiKeyHealth(): Promise<GeminiKeyHealthEntry[]> {
  if (healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) return healthCache.entries;

  const keys = await getGeminiKeys();
  const envPrimary = process.env.GEMINI_API_KEY?.trim() ?? "";
  const envBackup = process.env.GEMINI_BACKUP_API_KEY?.trim() ?? "";

  const slots: GeminiKeyHealthEntry[] = [];
  const seen = new Set<string>();
  const add = (slot: GeminiKeyHealth["slot"], key: string, label: string, source: GeminiKeySource, configured: boolean) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    slots.push({ slot, label, source, last4: maskSecret(key), configured, result: null, key });
  };
  add("primary", keys.primary, keys.primarySource === "db" ? "Primary key (database)" : "Primary key (env)", keys.primary ? "db" : "env", true);
  add("backup", keys.backup, keys.backupSource === "db" ? "Backup key (database)" : "Backup key (env)", keys.backup ? "db" : "env", true);
  // The env fallbacks are distinct credentials on their own — probe them too so
  // a scan that only survives via GEMINI_API_KEY is reported honestly.
  if (envPrimary && envPrimary !== keys.primary) add("envPrimary", envPrimary, "GEMINI_API_KEY env", "env", true);
  if (envBackup && envBackup !== keys.backup) add("envBackup", envBackup, "GEMINI_BACKUP_API_KEY env", "env", true);

  if (slots.length === 0) {
    healthCache = { at: Date.now(), entries: [] };
    return [];
  }

  const { probeGeminiKey } = await import("./client");
  const probed = await Promise.all(
    slots.map(async (s) => {
      const r = await probeGeminiKey(s.key);
      return { ...s, result: { ok: r.ok, kind: r.kind, message: r.message } };
    }),
  );

  healthCache = { at: Date.now(), entries: probed };
  return probed;
}

/** Drop the probe cache after a key change so statuses refresh immediately. */
export function clearGeminiHealthCache(): void {
  healthCache = null;
}