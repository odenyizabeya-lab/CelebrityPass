// Flutterwave V4 payment backend for the "ATM Card" checkout path (fan cards).
//
// The customer-facing name is "ATM Card" — the Flutterwave brand is never shown
// to fans. Card details are captured on Flutterwave's hosted page (PCI-compliant),
// so card numbers never touch our servers.
//
// Credential handling lives here and nothing else:
//   - Credentials are stored in the AppSetting table (server-side only),
//     encrypted at rest when AI_KEY_ENCRYPTION_KEY / SOCIAL_TOKEN_ENCRYPTION_KEY is set.
//   - They are NEVER returned to the browser (only booleans + a masked last-4),
//     never logged, and never included in error messages.
//   - Env-var overrides (recommended for production):
//       FLUTTERWAVE_ENABLED, FLUTTERWAVE_ENVIRONMENT,
//       FLUTTERWAVE_CLIENT_ID (or FLUTTERWAVE_PUBLIC_KEY),
//       FLUTTERWAVE_CLIENT_SECRET (or FLUTTERWAVE_SECRET_KEY),
//       FLUTTERWAVE_WEBHOOK_HASH.
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const FW_BASE_URL = "https://api.flutterwave.com/v3";

export const FW_SETTING_ENABLED = "flutterwave.enabled";
export const FW_SETTING_ENVIRONMENT = "flutterwave.environment";
export const FW_SETTING_CLIENT_ID = "flutterwave.client_id";
export const FW_SETTING_CLIENT_SECRET = "flutterwave.client_secret";
export const FW_SETTING_WEBHOOK_HASH = "flutterwave.webhook_hash";

const ENC_PREFIX = "enc1.";

/** Encryption secret for at-rest secrets; falls back to the AI/social-token one. */
function decryptionKey(): string {
  return process.env.AI_KEY_ENCRYPTION_KEY?.trim() || process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim() || "";
}

function encryptStoredKey(plain: string): string {
  const secret = decryptionKey();
  if (!secret || !plain) return plain;
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("hex")}.${tag.toString("hex")}.${enc.toString("hex")}`;
}

/** Decrypt an `enc1.`-prefixed stored secret. Legacy plaintext passes through. */
function decryptStoredKey(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const secret = decryptionKey();
  if (!secret) return ""; // encrypted at rest but the decryption key is missing — fail closed
  const body = stored.slice(ENC_PREFIX.length);
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

export type FlutterwaveConfig = {
  enabled: boolean;
  environment: "test" | "live" | "";
  clientId: string;
  clientSecret: string;
  webhookHash: string;
  clientIdSource: "db" | "env" | "";
  clientSecretSource: "db" | "env" | "";
  webhookHashSource: "db" | "env" | "";
  encryptionEnabled: boolean;
};

/** Resolve the effective Flutterwave config (settings first, then env fallbacks). */
export async function getFlutterwaveConfig(): Promise<FlutterwaveConfig> {
  const env = {
    enabled: (process.env.FLUTTERWAVE_ENABLED ?? "").trim().toLowerCase() === "true",
    environment: (process.env.FLUTTERWAVE_ENVIRONMENT ?? "").trim().toLowerCase() as "test" | "live" | "",
    clientId: (process.env.FLUTTERWAVE_CLIENT_ID ?? process.env.FLUTTERWAVE_PUBLIC_KEY ?? "").trim(),
    clientSecret: (process.env.FLUTTERWAVE_CLIENT_SECRET ?? process.env.FLUTTERWAVE_SECRET_KEY ?? "").trim(),
    webhookHash: (process.env.FLUTTERWAVE_WEBHOOK_HASH ?? "").trim(),
  };

  try {
    const [enabled, environment, storedId, storedSecret, storedHash] = await Promise.all([
      getSetting(FW_SETTING_ENABLED),
      getSetting(FW_SETTING_ENVIRONMENT),
      getSetting(FW_SETTING_CLIENT_ID),
      getSetting(FW_SETTING_CLIENT_SECRET),
      getSetting(FW_SETTING_WEBHOOK_HASH),
    ]);

    const secret = decryptStoredKey(storedSecret);
    const hash = decryptStoredKey(storedHash);

    // Migrate legacy plaintext rows to encrypted form once an encryption key is available.
    if (secret && !storedSecret.startsWith(ENC_PREFIX) && decryptionKey()) {
      await setSetting(FW_SETTING_CLIENT_SECRET, encryptStoredKey(secret));
    }
    if (hash && !storedHash.startsWith(ENC_PREFIX) && decryptionKey()) {
      await setSetting(FW_SETTING_WEBHOOK_HASH, encryptStoredKey(hash));
    }

    const dbEnvironment = environment === "live" ? "live" : environment === "test" ? "test" : "";

    return {
      enabled: env.enabled || enabled === "true",
      environment: env.environment || dbEnvironment,
      clientId: env.clientId || storedId,
      clientSecret: env.clientSecret || secret,
      webhookHash: env.webhookHash || hash,
      clientIdSource: env.clientId ? "env" : storedId ? "db" : "",
      clientSecretSource: env.clientSecret ? "env" : secret ? "db" : "",
      webhookHashSource: env.webhookHash ? "env" : hash ? "db" : "",
      encryptionEnabled: Boolean(decryptionKey()),
    };
  } catch {
    return {
      ...env,
      clientIdSource: env.clientId ? "env" : "",
      clientSecretSource: env.clientSecret ? "env" : "",
      webhookHashSource: env.webhookHash ? "env" : "",
      encryptionEnabled: Boolean(decryptionKey()),
    };
  }
}

/** True when the ATM Card path is fully configured end-to-end for fans. */
export function isFlutterwaveReady(config: FlutterwaveConfig): boolean {
  return config.enabled && (config.environment === "test" || config.environment === "live") && Boolean(config.clientId) && Boolean(config.clientSecret);
}

/** Mask a secret for display: "FLWS••••ck9H" / "••••" when short. */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "•".repeat(Math.min(6, trimmed.length));
  return `${trimmed.slice(0, 4)}${"•".repeat(6)}${trimmed.slice(-4)}`;
}

/** Best-effort environment hint ("test"|"live"|"") derived from a key prefix. */
export function envHint(secret: string): "test" | "live" | "" {
  const t = secret.trim();
  if (/^FLW(PUBK|SECK)_TEST-/.test(t)) return "test";
  if (/^FLW(PUBK|SECK)-/.test(t)) return "live";
  return "";
}

export type FlutterwaveStatus = {
  enabled: boolean;
  environment: "test" | "live" | "";
  clientId: string;
  clientIdConfigured: boolean;
  clientIdLast4: string;
  clientIdSource: "db" | "env" | "";
  clientSecretConfigured: boolean;
  clientSecretLast4: string;
  clientSecretSource: "db" | "env" | "";
  webhookHashConfigured: boolean;
  webhookHashLast4: string;
  webhookHashSource: "db" | "env" | "";
  baseUrl: string;
  encryptionEnabled: boolean;
  ready: boolean;
};

/** Client-safe, masked summary of the current Flutterwave configuration. */
export async function getFlutterwaveStatus(): Promise<FlutterwaveStatus> {
  const c = await getFlutterwaveConfig();
  return {
    enabled: c.enabled,
    environment: c.environment,
    clientId: c.clientId,
    clientIdConfigured: Boolean(c.clientId),
    clientIdLast4: maskSecret(c.clientId),
    clientIdSource: c.clientIdSource,
    clientSecretConfigured: Boolean(c.clientSecret),
    clientSecretLast4: maskSecret(c.clientSecret),
    clientSecretSource: c.clientSecretSource,
    webhookHashConfigured: Boolean(c.webhookHash),
    webhookHashLast4: maskSecret(c.webhookHash),
    webhookHashSource: c.webhookHashSource,
    baseUrl: FW_BASE_URL,
    encryptionEnabled: c.encryptionEnabled,
    ready: isFlutterwaveReady(c),
  };
}

/** Persist admin-saved Flutterwave settings. The secret/hash are encrypted at rest. */
export async function saveFlutterwaveSettings(params: {
  enabled?: boolean;
  environment?: "test" | "live";
  clientId?: string;
  clientSecret?: string;
  webhookHash?: string;
}): Promise<void> {
  if (typeof params.enabled === "boolean") await setSetting(FW_SETTING_ENABLED, params.enabled ? "true" : "false");
  if (params.environment === "test" || params.environment === "live") await setSetting(FW_SETTING_ENVIRONMENT, params.environment);
  if (params.clientId !== undefined) await setSetting(FW_SETTING_CLIENT_ID, params.clientId.trim());
  if (params.clientSecret !== undefined) await setSetting(FW_SETTING_CLIENT_SECRET, params.clientSecret.trim() ? encryptStoredKey(params.clientSecret.trim()) : "");
  if (params.webhookHash !== undefined) await setSetting(FW_SETTING_WEBHOOK_HASH, params.webhookHash.trim() ? encryptStoredKey(params.webhookHash.trim()) : "");
}

export type FwInitializeInput = {
  txRef: string;
  amount: number;
  currency: string;
  email: string;
  name?: string;
  redirectUrl: string;
  title: string;
};

export type FwInitializeResult = { ok: true; link: string; txRef: string } | { ok: false; error: string };

/** Create a hosted Flutterwave payment. The fan pays on Flutterwave, never here. */
export async function initializeFlutterwavePayment(input: FwInitializeInput): Promise<FwInitializeResult> {
  const config = await getFlutterwaveConfig();
  const blocked = (error: string): FwInitializeResult => ({ ok: false, error });

  if (!config.enabled) return blocked("Card payments are not enabled on this site yet.");
  if (!config.clientSecret) return blocked("The card processor isn't configured yet — please use Bank Transfer.");

  const amount = (Math.round(Number(input.amount) * 100) / 100).toFixed(2);

  const res = await fetch(`${FW_BASE_URL}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.clientSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount,
      currency: (input.currency || "USD").toUpperCase(),
      redirect_url: input.redirectUrl,
      customer: { email: input.email, name: input.name?.trim() || input.email },
      customizations: { title: input.title.slice(0, 100), description: `CelebrityPass — ${input.txRef}` },
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      (data?.message && typeof data.message === "string" ? data.message : "") ||
      (res.status === 401 || res.status === 403 ? "The card processor credentials are invalid." : "The payment provider is unavailable right now.");
    return blocked(msg);
  }

  const link = data?.data?.link;
  if (typeof link !== "string" || !link) return blocked("The payment provider did not return a payment link.");
  return { ok: true, link, txRef: input.txRef };
}

export type FwVerifiedTransaction = {
  txRef: string;
  id: string | number | null;
  amount: number;
  currency: string;
  status: string;
  email?: string;
  name?: string;
};

export type FwVerifyResult = { ok: true; transaction: FwVerifiedTransaction } | { ok: false; error: string };

/** Server-side verification of a Flutterwave transaction by its tx_ref. */
export async function verifyFlutterwaveTransaction(txRef: string): Promise<FwVerifyResult> {
  const config = await getFlutterwaveConfig();
  if (!config.clientSecret) return { ok: false, error: "The card processor isn't configured." };

  const res = await fetch(`${FW_BASE_URL}/transactions/${encodeURIComponent(txRef)}/verify`, {
    headers: { Authorization: `Bearer ${config.clientSecret}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) return { ok: false, error: data?.message || `Flutterwave verification failed (HTTP ${res.status}).` };
  const d = data?.data;
  if (!d) return { ok: false, error: "Flutterwave returned an empty verification response." };

  return {
    ok: true,
    transaction: {
      txRef: String(d.tx_ref ?? txRef),
      id: d.id ?? null,
      amount: Number(d.amount) || 0,
      currency: String(d.currency ?? "").toUpperCase(),
      status: String(d.status ?? "").toLowerCase(),
      email: d.customer?.email,
      name: d.customer?.name,
    },
  };
}

/**
 * Verify the Flutterwave webhook signature (the `x-verif-hash` header against
 * the stored/configured webhook secret). Constant-time compare, fail closed.
 */
export async function verifyFlutterwaveWebhook(received: string | null | undefined): Promise<boolean> {
  if (!received) return false;
  const config = await getFlutterwaveConfig();
  const expected = config.webhookHash;
  if (!expected || expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

/**
 * Format check only — Flutterwave keys are FLWPUBK(_TEST)- (public) /
 * FLWSECK(_TEST)- (secret). Note the underscore: test keys are suffixed
 * `_TEST-`, e.g. `FLWSECK_TEST-31c2f57a4c9e…-X`.
 */
export function isPlausibleFlutterwaveKey(kind: "client_id" | "client_secret", key: string): boolean {
  const t = key.trim();
  if (kind === "client_id") return /^FLWPUBK(_TEST)?-[0-9A-Za-z_-]{10,}$/.test(t);
  return /^FLWSECK(_TEST)?-[0-9A-Za-z_-]{10,}$/.test(t);
}

export type FwTestResult = {
  ok: boolean;
  code: "ok" | "invalid_key" | "format" | "none" | "network" | "timeout" | "server" | string;
  message: string;
  mode: "test" | "live" | "";
};

/**
 * Prove credentials work with a real Flutterwave call. We query a transaction
 * reference that cannot exist: HTTP 401/403 = bad secret, HTTP 404 = the key
 * authenticated successfully (reference not found is the expected outcome).
 */
export async function testFlutterwaveConnection(opts: {
  clientId?: string;
  clientSecret?: string;
  environment?: "test" | "live" | "";
}): Promise<FwTestResult> {
  const config = await getFlutterwaveConfig();
  const secret = opts.clientSecret?.trim() || config.clientSecret;
  const id = opts.clientId?.trim() || config.clientId;
  const mode: "test" | "live" | "" = opts.environment || config.environment || envHint(secret);

  if (!secret) {
    return {
      ok: false,
      code: "none",
      message: "No Flutterwave secret key is configured yet. Paste a FLWSECK-… key above (or set FLUTTERWAVE_CLIENT_SECRET in the environment), then test.",
      mode,
    };
  }
  if (!isPlausibleFlutterwaveKey("client_secret", secret)) {
    return {
      ok: false,
      code: "format",
      message:
        "That doesn't look like a Flutterwave secret key (Public key = FLWPUBK-…, Secret key = FLWSECK-…). The v4 dashboard 'Client ID' (a UUID like 9543ec71-…) won't work — get these keys from Settings → API Keys and switch to the v3 'Public Key / Secret Key' view. The key was NOT sent to Flutterwave.",
      mode,
    };
  }
  if (id && !isPlausibleFlutterwaveKey("client_id", id)) {
    return {
      ok: false,
      code: "format",
      message:
        "That doesn't look like a Flutterwave public key — it must start with FLWPUBK-. The v4 dashboard 'Client ID' (a UUID like 9543ec71-…) is not the public key; copy the Public Key (FLWPUBK-…) from Settings → API Keys. The value was NOT sent to Flutterwave.",
      mode,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let res: Response | null = null;
  try {
    res = await fetch(`${FW_BASE_URL}/transactions/verify_by_reference?tx_ref=celebpass-test-${Date.now()}`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    clearTimeout(timer);
    const code = (err as Error)?.name === "AbortError" ? "timeout" : "network";
    return {
      ok: false,
      code,
      mode,
      message:
        code === "timeout"
          ? "Flutterwave did not respond within 20 seconds. Try again."
          : "Could not reach Flutterwave (network error). Check connectivity and try again.",
    };
  }
  clearTimeout(timer);

  if (!res) return { ok: false, code: "server", mode, message: "The Flutterwave API did not respond. Try again." };

  if (res.ok || res.status === 404) {
    return {
      ok: true,
      code: "ok",
      mode,
      message: `Credentials valid — Flutterwave authenticated this request${
        res.status === 404 ? " (test reference not found, exactly as expected)" : ""
      } in ${mode || "unknown"} mode.`,
    };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      code: "invalid_key",
      mode,
      message: `Flutterwave rejected the secret key as invalid (HTTP ${res.status}). Double-check it was copied fully, and that it matches the selected ${mode || ""} environment.`,
    };
  }
  return {
    ok: false,
    code: "server",
    mode,
    message: `Flutterwave returned HTTP ${res.status}. The key may be valid, but the account needs attention (for example, disabled or unauthorized).`,
  };
}