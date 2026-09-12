// Flutterwave V4 payment backend for the "ATM Card" checkout path (fan cards).
//
// The customer-facing name is "ATM Card" — the Flutterwave brand is never shown
// to fans. Card details are captured on Flutterwave's hosted checkout page
// (PCI-compliant), so card numbers never touch our servers.
//
// This is the V4 API — NOT the legacy V3 /v3/payments / public/secret-key flow.
// Credentials are a v4 Client ID + Client Secret from Settings → API Keys
// (UUIDs, no FLWPUBK-/FLWSECK- prefix). Auth is OAuth2 client-credentials:
//   POST https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token
// The token expires after 600s and is cached in memory until 60s before expiry.
//
// Flow:
//   1. createCheckoutSession()  → hosted checkout_url (customer pays there)
//   2. Payment stays PENDING; gatewayRef = the session `reference`
//   3. webhook `charge.completed` (HMAC-SHA256 over the raw body) + a server-side
//      GET /charges/{id} re-check are the ONLY things that settle a payment.
//   4. The callback route ONLY shows the customer a "confirming" page that polls
//      the payment status — settlement is never driven from the browser redirect.
//
// Credential handling lives here and nothing else:
//   - Credentials are stored in the AppSetting table (server-side only),
//     encrypted at rest when AI_KEY_ENCRYPTION_KEY / SOCIAL_TOKEN_ENCRYPTION_KEY is set.
//   - They are NEVER returned to the browser (only booleans + a masked last-4),
//     never logged, and never included in error messages.
//   - Env-var overrides (recommended for production):
//       FLUTTERWAVE_ENABLED, FLUTTERWAVE_ENVIRONMENT (test|live),
//       FLUTTERWAVE_CLIENT_ID, FLUTTERWAVE_CLIENT_SECRET, FLUTTERWAVE_WEBHOOK_HASH.
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/utils";

/** Flutterwave V4 identity provider — OAuth2 client-credentials token endpoint. */
export const FW_TOKEN_URL = "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";

/** Base API URL per environment (official V4 Environments doc). */
export function flutterwaveApiBaseUrl(environment: "test" | "live" | ""): string {
  if (environment === "live") return "https://f4bexperience.flutterwave.com";
  return "https://developersandbox-api.flutterwave.com";
}

export const FW_SETTING_ENABLED = "flutterwave.enabled";
export const FW_SETTING_ENVIRONMENT = "flutterwave.environment";
export const FW_SETTING_CLIENT_ID = "flutterwave.client_id";
export const FW_SETTING_CLIENT_SECRET = "flutterwave.client_secret";
export const FW_SETTING_WEBHOOK_HASH = "flutterwave.webhook_hash";

const ENC_PREFIX = "enc1.";

const REQUEST_TIMEOUT_MS = 25_000;
const TOKEN_LEEWAY_MS = 60_000;

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
    clientId: (process.env.FLUTTERWAVE_CLIENT_ID ?? "").trim(),
    clientSecret: (process.env.FLUTTERWAVE_CLIENT_SECRET ?? "").trim(),
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

    const dbEnvironment: "test" | "live" | "" = environment === "live" ? "live" : environment === "test" ? "test" : "";

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

/** Mask a secret for display: "9543••••2a1f" / "••••" when short. */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "•".repeat(Math.min(6, trimmed.length));
  return `${trimmed.slice(0, 4)}${"•".repeat(6)}${trimmed.slice(-4)}`;
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
  apiBaseUrl: string;
  webhookUrl: string;
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
    apiBaseUrl: flutterwaveApiBaseUrl(c.environment),
    webhookUrl: `${appUrl()}/api/payments/flutterwave/webhook`,
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

// ---------------------------------------------------------------------------
// OAuth2 client-credentials token (V4)
// ---------------------------------------------------------------------------

type FwTokenFailure = { code: "invalid_credentials" | "network" | "timeout" | "server" | "unconfigured" | "http_error"; message: string };

/** Cache the V4 access token until 60s before its 600s expiry. */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function acquireToken(config: {
  clientId: string;
  clientSecret: string;
  signal?: AbortSignal;
}): Promise<{ ok: true; token: string } | { ok: false; failure: FwTokenFailure }> {
  if (!config.clientId || !config.clientSecret) {
    return { ok: false, failure: { code: "unconfigured", message: "The card processor isn't configured yet." } };
  }
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_LEEWAY_MS) {
    return { ok: true, token: cachedToken.token };
  }

  try {
    const res = await fetch(FW_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "client_credentials",
      }).toString(),
      signal: config.signal,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = String(data?.error_description || data?.error || data?.message || "").slice(0, 160);
      if (res.status === 401 || res.status === 403 || res.status === 400) {
        return { ok: false, failure: { code: "invalid_credentials", message: `Flutterwave rejected these credentials (${res.status})${detail ? ` — ${detail}` : ""}.` } };
      }
      return { ok: false, failure: { code: "http_error", message: `The identity server returned HTTP ${res.status}.` } };
    }

    const token = typeof data?.access_token === "string" && data.access_token ? data.access_token : "";
    const expiresIn = Number(data?.expires_in) > 0 ? Number(data.expires_in) : 600;
    if (!token) {
      return { ok: false, failure: { code: "server", message: "The identity server returned no access token." } };
    }
    cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
    return { ok: true, token };
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    return {
      ok: false,
      failure: { code: aborted ? "timeout" : "network", message: aborted ? "The identity server did not respond in time. Try again." : "Could not reach the Flutterwave identity server (network error)." },
    };
  }
}

/** Flutterwave V4 requires X-Trace-Id; retrying checkout calls with X-Idempotency-Key is safe. */
function fwHeaders(token: string, idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Trace-Id": crypto.randomUUID(),
  };
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;
  return headers;
}

async function fwFetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Checkout sessions (V4 hosted page)
// ---------------------------------------------------------------------------

export type FwInitializeInput = {
  txRef: string;
  amount: number;
  currency: string;
  redirectUrl: string;
  title: string;
};

export type FwInitializeResult = { ok: true; link: string; txRef: string } | { ok: false; error: string };

/**
 * Open a Flutterwave V4 hosted checkout session. The fan pays on Flutterwave,
 * never here. The returned `checkout_url` is where we redirect the customer.
 */
export async function initializeFlutterwavePayment(input: FwInitializeInput): Promise<FwInitializeResult> {
  const config = await getFlutterwaveConfig();
  const base = flutterwaveApiBaseUrl(config.environment);
  const blocked = (error: string): FwInitializeResult => ({ ok: false, error });

  if (!config.enabled) return blocked("Card payments are not enabled on this site yet.");
  if (!config.clientId || !config.clientSecret) return blocked("The card processor isn't configured yet — please use Bank Transfer.");
  if (!base) return blocked("Card payments need an environment (Test or Live) to be configured.");

  const token = await acquireToken({ clientId: config.clientId, clientSecret: config.clientSecret });
  if (!token.ok) return blocked(token.failure.message);

  // V4 `reference` must match ^[a-zA-Z0-9\-]+$ and be ≤42 chars. Our own txRef
  // ("CP-" + payment id) is used as the session reference and stored as gatewayRef.
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return blocked("This payment has no amount to charge.");

  const body = {
    amount,
    currency: (input.currency || "USD").toUpperCase().slice(0, 3),
    reference: input.txRef,
    redirect_url: input.redirectUrl,
    scenario: "retail_checkout",
    pin_verification: "disable",
    enabled_payment_methods: ["card"],
    customizations: {
      title: (input.title || "Fan Card").slice(0, 100),
      description: `CelebrityPass order ${input.txRef}`.slice(0, 255),
    },
  };

  let res: Response;
  try {
    res = await fwFetchWithTimeout(`${base}/checkout/sessions`, {
      method: "POST",
      headers: fwHeaders(token.token, input.txRef),
      body: JSON.stringify(body),
    });
  } catch {
    return blocked("The payment provider is unavailable right now. Please try again or use Bank Transfer.");
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = String(data?.error?.message || data?.data?.error_message || data?.message || "").slice(0, 200);
    if (res.status === 401 || res.status === 403) {
      return blocked("The card processor credentials are invalid — please use Bank Transfer for now.");
    }
    return blocked(`The payment provider couldn't start a session${detail ? ` (${detail})` : ""}. Please try again or use Bank Transfer.`);
  }

  const link = data?.data?.checkout_url;
  if (typeof link !== "string" || !link) return blocked("The payment provider did not return a payment link.");
  return { ok: true, link, txRef: input.txRef };
}

// ---------------------------------------------------------------------------
// Server-side verification (V4 charges)
// ---------------------------------------------------------------------------

export type FwVerifiedCharge = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
};

export type FwVerifyResult = { ok: true; charge: FwVerifiedCharge } | { ok: false; error: string };

/** Re-query a V4 charge by its id to confirm status/amount/currency server-side. */
export async function verifyFlutterwaveCharge(chargeId: string): Promise<FwVerifyResult> {
  if (!chargeId) return { ok: false, error: "No charge id to verify." };
  const config = await getFlutterwaveConfig();
  const base = flutterwaveApiBaseUrl(config.environment);
  if (!config.clientId || !config.clientSecret || !base) return { ok: false, error: "The card processor isn't configured." };

  const token = await acquireToken({ clientId: config.clientId, clientSecret: config.clientSecret });
  if (!token.ok) return { ok: false, error: token.failure.message };

  let res: Response;
  try {
    res = await fwFetchWithTimeout(`${base}/charges/${encodeURIComponent(chargeId)}`, {
      method: "GET",
      headers: fwHeaders(token.token),
    });
  } catch {
    return { ok: false, error: "Could not reach the payment provider to verify the charge." };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: data?.error?.message || data?.message || `Flutterwave charge verification failed (HTTP ${res.status}).` };
  }
  const d = data?.data;
  if (!d) return { ok: false, error: "Flutterwave returned an empty charge verification response." };

  return {
    ok: true,
    charge: {
      id: String(d.id ?? chargeId),
      reference: String(d.reference ?? ""),
      amount: Number(d.amount) || 0,
      currency: String(d.currency ?? "").toUpperCase(),
      status: String(d.status ?? "").toLowerCase(),
    },
  };
}

// ---------------------------------------------------------------------------
// Webhooks (V4)
// ---------------------------------------------------------------------------

/**
 * Verify a Flutterwave V4 webhook. The `flutterwave-signature` header holds
 * base64(HMAC-SHA256(rawBody, secretHash)). Legacy `x-verif-hash` (V3-style
 * dashboards) is also accepted when the header is present. Constant-time
 * compare, fail closed — the raw request body must be hashed, not the JSON.
 */
export async function verifyFlutterwaveWebhook(input: {
  rawBody: string;
  signatureHeader: string | null;
  verifHashHeader: string | null;
}): Promise<boolean> {
  const config = await getFlutterwaveConfig();
  const expected = config.webhookHash;
  if (!expected) return false;

  const signature = typeof input.signatureHeader === "string" ? input.signatureHeader.trim() : "";
  if (signature) {
    const expectedDigest = crypto.createHmac("sha256", expected).update(input.rawBody ?? "").digest("base64");
    const a = Buffer.from(expectedDigest);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  const legacy = typeof input.verifHashHeader === "string" ? input.verifHashHeader.trim() : "";
  if (legacy) {
    const a = Buffer.from(expected);
    const b = Buffer.from(legacy);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Credential sanity checks (V4)
// ---------------------------------------------------------------------------

/**
 * Format check only — V4 Client ID / Client Secret are opaque strings (the
 * dashboard shows Client ID as a UUID, Client Secret as a long token). We just
 * reject obvious paste errors (spaces, way-too-short strings) so a full call to
 * the identity server can genuinely validate them.
 */
export function isPlausibleFlutterwaveKey(kind: "client_id" | "client_secret", key: string): boolean {
  const t = key.trim();
  if (!t) return false;
  if (kind === "client_id") return /^[A-Za-z0-9_-]{12,}$/.test(t);
  return /^[A-Za-z0-9_-]{16,}$/.test(t);
}

// ---------------------------------------------------------------------------
// Connection test
// ---------------------------------------------------------------------------

export type FwTestResult = {
  ok: boolean;
  code: "ok" | "invalid_key" | "format" | "none" | "network" | "timeout" | "server" | string;
  message: string;
  mode: "test" | "live" | "";
};

/** Prove V4 credentials work: acquire an access token, then probe the API. */
export async function testFlutterwaveConnection(opts: {
  clientId?: string;
  clientSecret?: string;
  environment?: "test" | "live" | "";
}): Promise<FwTestResult> {
  const config = await getFlutterwaveConfig();
  const id = opts.clientId?.trim() || config.clientId;
  const secret = opts.clientSecret?.trim() || config.clientSecret;
  const mode: "test" | "live" | "" = opts.environment || config.environment;

  if (!id && !secret) {
    return {
      ok: false,
      code: "none",
      message: "No Flutterwave V4 credentials are configured yet. Paste your Client ID and Client Secret above (or set FLUTTERWAVE_CLIENT_ID / FLUTTERWAVE_CLIENT_SECRET in the environment), then test.",
      mode,
    };
  }
  if (!id || !secret) {
    return {
      ok: false,
      code: "none",
      message: "Both a Client ID and a Client Secret are required. Enter both, then test.",
      mode,
    };
  }
  if (!isPlausibleFlutterwaveKey("client_id", id) || !isPlausibleFlutterwaveKey("client_secret", secret)) {
    return {
      ok: false,
      code: "format",
      message:
        "That doesn't look like a Flutterwave v4 credential. From Settings → API Keys copy the Client ID (a UUID like 9543ec71-…) and the Client Secret. The v3 Public/Secret keys (FLWPUBK-… / FLWSECK-…) are NOT accepted here. The value was NOT sent to Flutterwave.",
      mode,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  const token = await acquireToken({ clientId: id, clientSecret: secret, signal: controller.signal });
  if (!token.ok) {
    clearTimeout(timer);
    const f = token.failure;
    if (f.code === "unconfigured") return { ok: false, code: "none", message: f.message, mode };
    if (f.code === "invalid_credentials") return { ok: false, code: "invalid_key", message: f.message, mode };
    return { ok: false, code: f.code, message: f.message, mode };
  }

  // Lightweight read to confirm the token works against the chosen environment.
  let res: Response | null = null;
  try {
    res = await fetch(`${flutterwaveApiBaseUrl(mode)}/charges?page=1&size=1`, {
      headers: fwHeaders(token.token),
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
      message: code === "timeout" ? "Flutterwave did not respond within 20 seconds. Try again." : "Could not reach Flutterwave (network error). Check connectivity and try again.",
    };
  }
  clearTimeout(timer);

  if (!res) return { ok: false, code: "server", mode, message: "The Flutterwave API did not respond. Try again." };

  if (res.ok) {
    return {
      ok: true,
      code: "ok",
      mode,
      message: `Credentials valid — Flutterwave authenticated this request against its ${mode || "selected"} environment.`,
    };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      code: "invalid_key",
      mode,
      message: `Flutterwave rejected these credentials as invalid (HTTP ${res.status}). Double-check they were copied fully and match the selected ${mode || ""} environment.`,
    };
  }
  return {
    ok: false,
    code: "server",
    mode,
    message: `Flutterwave returned HTTP ${res.status}. The credentials may be valid, but the account needs attention (for example, disabled or unauthorized).`,
  };
}