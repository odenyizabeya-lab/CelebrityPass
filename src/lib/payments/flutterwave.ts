// Flutterwave V3 payment backend for the "ATM Card" checkout path (fan cards).
//
// The customer-facing name is "ATM Card" — the Flutterwave brand is never shown
// to fans. This is the legacy V3 "Standard" hosted-checkout flow — NOT the v4
// client-credentials + client-side-encryption flow. There is no card data on
// this server and no browser-side encryption: the fan pays on Flutterwave's own
// hosted payment page.
//
// Flow (V3 Standard hosted checkout):
//   1. This app creates a payment server-side:
//      POST https://api.flutterwave.com/v3/payments
//      (tx_ref, amount, currency, redirect_url, customer, customizations)
//   2. Flutterwave returns a hosted link (data.link) — we redirect the fan there.
//   3. The fan pays on Flutterwave's page; Flutterwave redirects the fan back to
//      our redirect_url (?status=&tx_ref=&transaction_id=) and fires a webhook.
//   4. The webhook (`charge.completed`, verified via `verif-hash` / the
//      `flutterwave-signature` header) + a server-side GET /transactions/{id}/verify
//      re-check are the ONLY things that settle a payment.
//   5. The callback route just shows a "confirming" page that polls the payment
//      status — settlement is never driven from the browser redirect.
//
// Credentials are the legacy V3 Public Key + Secret Key from Settings → API Keys
// (FLWPUBK-… / FLWSECK-…). Only the Secret Key is required for hosted checkout;
// the Public Key is accepted too (needed for the Inline/JS checkout, not shipped).
// Test keys (FLWSECK_TEST-…) only work against the test environment.
//
// Payment.lookup key: gatewayRef stores the tx_ref ("CP-<paymentId>"), which is
// exactly the `tx_ref` used when creating the payment, so the webhook and its
// server-side re-verification can always find this payment.
//
// Credential handling lives here and nothing else:
//   - Credentials are stored in the AppSetting table (server-side only),
//     encrypted at rest when AI_KEY_ENCRYPTION_KEY / SOCIAL_TOKEN_ENCRYPTION_KEY is set.
//   - They are NEVER returned to the browser (only booleans + a masked last-4),
//     never logged, and never included in error messages.
//   - Env-var overrides (recommended for production):
//       FLUTTERWAVE_ENABLED, FLUTTERWAVE_ENVIRONMENT (test|live),
//       FLUTTERWAVE_SECRET_KEY, FLUTTERWAVE_PUBLIC_KEY, FLUTTERWAVE_WEBHOOK_HASH.
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/utils";

/**
 * V3 uses a single API base for test and live; environment selects the keys.
 * (Kept as a function for parity with the old v4 route and so tests can stub it.)
 */
export function flutterwaveApiBaseUrl(_environment: "test" | "live" | ""): string {
  void _environment;
  return "https://api.flutterwave.com/v3";
}

export const FW_SETTING_ENABLED = "flutterwave.enabled";
export const FW_SETTING_ENVIRONMENT = "flutterwave.environment";
export const FW_SETTING_SECRET_KEY = "flutterwave.secret_key";
export const FW_SETTING_PUBLIC_KEY = "flutterwave.public_key";
export const FW_SETTING_WEBHOOK_HASH = "flutterwave.webhook_hash";

const ENC_PREFIX = "enc1.";

const REQUEST_TIMEOUT_MS = 25_000;

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

async function getSetting(key: string, opts?: { strict?: boolean }): Promise<string> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    return row?.value?.trim() ?? "";
  } catch (e) {
    // Settings reads that must NEVER be mistaken for a real value (e.g. the
    // admin status view) propagate the error; the default is a best-effort ""
    // used by low-level checkout paths that fail closed anyway.
    if (opts?.strict) throw e;
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
  secretKey: string;
  publicKey: string;
  webhookHash: string;
  secretKeySource: "db" | "env" | "";
  publicKeySource: "db" | "env" | "";
  webhookHashSource: "db" | "env" | "";
  encryptionEnabled: boolean;
};

/**
 * Resolve the effective Flutterwave config (settings first, then env fallbacks).
 * pass `{ strict: true }` when the caller must never mistake a DB hiccup for a
 * real "disabled" setting (the admin status view). Default stays fail-closed
 * for checkout paths.
 */
export async function getFlutterwaveConfig(opts?: { strict?: boolean }): Promise<FlutterwaveConfig> {
  const strict = opts?.strict === true;
  const env = {
    enabled: (process.env.FLUTTERWAVE_ENABLED ?? "").trim().toLowerCase() === "true",
    environment: (process.env.FLUTTERWAVE_ENVIRONMENT ?? "").trim().toLowerCase() as "test" | "live" | "",
    secretKey: (process.env.FLUTTERWAVE_SECRET_KEY ?? "").trim(),
    publicKey: (process.env.FLUTTERWAVE_PUBLIC_KEY ?? "").trim(),
    webhookHash: (process.env.FLUTTERWAVE_WEBHOOK_HASH ?? "").trim(),
  };

  try {
    const [enabled, environment, storedSecret, storedPublic, storedHash] = await Promise.all([
      getSetting(FW_SETTING_ENABLED, { strict }),
      getSetting(FW_SETTING_ENVIRONMENT, { strict }),
      getSetting(FW_SETTING_SECRET_KEY, { strict }),
      getSetting(FW_SETTING_PUBLIC_KEY, { strict }),
      getSetting(FW_SETTING_WEBHOOK_HASH, { strict }),
    ]);

    const secret = decryptStoredKey(storedSecret);
    const pub = decryptStoredKey(storedPublic);
    const hash = decryptStoredKey(storedHash);

    // Migrate legacy plaintext rows to encrypted form once an encryption key is available.
    if (secret && !storedSecret.startsWith(ENC_PREFIX) && decryptionKey()) {
      await setSetting(FW_SETTING_SECRET_KEY, encryptStoredKey(secret));
    }
    if (pub && !storedPublic.startsWith(ENC_PREFIX) && decryptionKey()) {
      await setSetting(FW_SETTING_PUBLIC_KEY, encryptStoredKey(pub));
    }
    if (hash && !storedHash.startsWith(ENC_PREFIX) && decryptionKey()) {
      await setSetting(FW_SETTING_WEBHOOK_HASH, encryptStoredKey(hash));
    }

    const dbEnvironment: "test" | "live" | "" = environment === "live" ? "live" : environment === "test" ? "test" : "";

    return {
      enabled: env.enabled || enabled === "true",
      environment: env.environment || dbEnvironment,
      secretKey: env.secretKey || secret,
      publicKey: env.publicKey || pub,
      webhookHash: env.webhookHash || hash,
      secretKeySource: env.secretKey ? "env" : secret ? "db" : "",
      publicKeySource: env.publicKey ? "env" : pub ? "db" : "",
      webhookHashSource: env.webhookHash ? "env" : hash ? "db" : "",
      encryptionEnabled: Boolean(decryptionKey()),
    };
  } catch (e) {
    if (strict) throw e;
    return {
      ...env,
      secretKeySource: env.secretKey ? "env" : "",
      publicKeySource: env.publicKey ? "env" : "",
      webhookHashSource: env.webhookHash ? "env" : "",
      encryptionEnabled: Boolean(decryptionKey()),
    };
  }
}

/** True when the ATM Card path is fully configured end-to-end for fans. */
export function isFlutterwaveReady(config: FlutterwaveConfig): boolean {
  return (
    config.enabled &&
    (config.environment === "test" || config.environment === "live") &&
    Boolean(config.secretKey) &&
    Boolean(config.webhookHash)
  );
}

/** Mask a secret for display: "abcd••••wxyz" / "••••" when short. */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "•".repeat(Math.min(6, trimmed.length));
  return `${trimmed.slice(0, 4)}${"•".repeat(6)}${trimmed.slice(-4)}`;
}

export type FlutterwaveStatus = {
  enabled: boolean;
  environment: "test" | "live" | "";
  secretKeyConfigured: boolean;
  secretKeyLast4: string;
  secretKeySource: "db" | "env" | "";
  publicKeyConfigured: boolean;
  publicKeyLast4: string;
  publicKeySource: "db" | "env" | "";
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
  // strict: a database read failure must throw and surface as an error, never
  // silently masquerade as "processor disabled".
  const c = await getFlutterwaveConfig({ strict: true });
  return {
    enabled: c.enabled,
    environment: c.environment,
    secretKeyConfigured: Boolean(c.secretKey),
    secretKeyLast4: maskSecret(c.secretKey),
    secretKeySource: c.secretKeySource,
    publicKeyConfigured: Boolean(c.publicKey),
    publicKeyLast4: maskSecret(c.publicKey),
    publicKeySource: c.publicKeySource,
    webhookHashConfigured: Boolean(c.webhookHash),
    webhookHashLast4: maskSecret(c.webhookHash),
    webhookHashSource: c.webhookHashSource,
    apiBaseUrl: flutterwaveApiBaseUrl(c.environment),
    webhookUrl: `${appUrl()}/api/payments/flutterwave/webhook`,
    encryptionEnabled: c.encryptionEnabled,
    ready: isFlutterwaveReady(c),
  };
}

/** Persist admin-saved Flutterwave settings. The secret/pub/hash are encrypted at rest. */
export async function saveFlutterwaveSettings(params: {
  enabled?: boolean;
  environment?: "test" | "live";
  secretKey?: string;
  publicKey?: string;
  webhookHash?: string;
}): Promise<void> {
  if (typeof params.enabled === "boolean") await setSetting(FW_SETTING_ENABLED, params.enabled ? "true" : "false");
  if (params.environment === "test" || params.environment === "live") await setSetting(FW_SETTING_ENVIRONMENT, params.environment);
  if (params.secretKey !== undefined) await setSetting(FW_SETTING_SECRET_KEY, params.secretKey.trim() ? encryptStoredKey(params.secretKey.trim()) : "");
  if (params.publicKey !== undefined) await setSetting(FW_SETTING_PUBLIC_KEY, params.publicKey.trim() ? encryptStoredKey(params.publicKey.trim()) : "");
  if (params.webhookHash !== undefined)
    await setSetting(FW_SETTING_WEBHOOK_HASH, params.webhookHash.trim() ? encryptStoredKey(params.webhookHash.trim()) : "");
}

/** Format check only — V3 keys carry the FLWPUBK-/FLWSECK- prefix; obvious paste errors are rejected. */
export function isPlausibleFlutterwaveKey(kind: "public_key" | "secret_key", key: string): boolean {
  const t = key.trim();
  if (!t) return false;
  if (kind === "public_key") return /^FLWPUBK(_TEST)?-.{8,}$/.test(t);
  return /^FLWSECK(_TEST)?-.{8,}$/.test(t);
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

/** V3 secret-key auth: every call is authorized with the Secret Key as a Bearer token. */
function v3Headers(secretKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Hosted checkout (Standard flow)
// ---------------------------------------------------------------------------

export type FwHostedCheckoutInput = {
  txRef: string;
  amount: number;
  currency: string;
  redirectUrl: string;
  customer: {
    name: string;
    email: string;
    phonenumber?: string;
  };
  title: string;
  description?: string;
};

export type FwHostedCheckoutResult =
  | { ok: true; link: string; txRef: string; status: "new" | "pending" | "failed" | string }
  | { ok: false; error: string };

async function v3Request(config: FlutterwaveConfig, path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const base = flutterwaveApiBaseUrl(config.environment);
  let res: Response;
  try {
    res = await fwFetchWithTimeout(`${base}${path}`, {
      method: init.method,
      headers: Object.fromEntries(
        Object.entries({
          ...v3Headers(config.secretKey),
          ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        }).filter(([, v]) => v !== undefined),
      ),
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    return { ok: false, error: "The payment provider is unavailable right now. Please try again or use Bank Transfer." };
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = String(body?.message || body?.error?.message || "").slice(0, 200);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "The card processor credentials are invalid — please use Bank Transfer for now." };
    }
    return { ok: false, error: `The payment provider couldn't complete this${detail ? ` (${detail})` : ""}. Please try again or use Bank Transfer.` };
  }
  return { ok: true, data: body as Record<string, unknown> };
}

/**
 * Create a V3 hosted payment. Returns the link the fan must be redirected to;
 * Flutterwave collects the card details on their own page — card data never
 * touches this server. The same tx_ref can be asked for again without creating
 * a duplicate (the webhook matches the payment by this exact reference).
 */
export async function createFlutterwaveHostedCheckout(input: FwHostedCheckoutInput): Promise<FwHostedCheckoutResult> {
  const config = await getFlutterwaveConfig();

  if (!config.enabled) return { ok: false, error: "Card payments are not enabled on this site yet." };
  if (!isFlutterwaveReady(config)) {
    return { ok: false, error: "The card processor isn't configured yet — please use Bank Transfer." };
  }

  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "This payment has no amount to charge." };

  const res = await v3Request(config, "/payments", {
    method: "POST",
    body: {
      tx_ref: input.txRef,
      amount,
      currency: (input.currency || "USD").toUpperCase().slice(0, 3),
      redirect_url: input.redirectUrl,
      customer: {
        name: (input.customer.name || "Fan").trim().slice(0, 200),
        email: (input.customer.email || "").toLowerCase().trim().slice(0, 254),
        ...(input.customer.phonenumber ? { phonenumber: input.customer.phonenumber.trim().slice(0, 20) } : {}),
      },
      customizations: {
        title: (input.title || "Payment").slice(0, 200),
        ...(input.description ? { description: input.description.slice(0, 255) } : {}),
      },
    },
  });
  if (!res.ok) return res;

  const link = String(res.data?.link ?? "");
  if (!link) return { ok: false, error: "The payment provider returned no payment link." };

  return { ok: true, link, txRef: input.txRef, status: String(res.data?.status ?? "pending") };
}

// ---------------------------------------------------------------------------
// Transaction verification
// ---------------------------------------------------------------------------

export type FwVerifiedTransaction = {
  id: string;
  txRef: string;
  amount: number;
  currency: string;
  status: string;
};

export type FwVerifyResult = { ok: true; tx: FwVerifiedTransaction } | { ok: false; error: string };

/** Re-query a V3 transaction by its id to confirm status/amount/currency server-side. */
export async function verifyFlutterwaveTransaction(transactionId: string): Promise<FwVerifyResult> {
  if (!transactionId) return { ok: false, error: "No transaction id to verify." };
  const config = await getFlutterwaveConfig();
  if (!config.secretKey) return { ok: false, error: "The card processor isn't configured." };

  let res: Response;
  try {
    res = await fwFetchWithTimeout(`${flutterwaveApiBaseUrl(config.environment)}/transactions/${encodeURIComponent(transactionId)}/verify`, {
      method: "GET",
      headers: v3Headers(config.secretKey),
    });
  } catch {
    return { ok: false, error: "Could not reach the payment provider to verify the charge." };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: data?.message || `Flutterwave verification failed (HTTP ${res.status}).` };
  }
  const d = data?.data;
  if (!d) return { ok: false, error: "Flutterwave returned an empty verification response." };

  return {
    ok: true,
    tx: {
      id: String(d.id ?? transactionId),
      txRef: String(d.tx_ref ?? ""),
      amount: Number(d.amount) || 0,
      currency: String(d.currency ?? "").toUpperCase(),
      status: String(d.status ?? "").toLowerCase(),
    },
  };
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/**
 * Verify a Flutterwave webhook. `flutterwave-signature` is base64(HMAC-SHA256(
 * rawBody, secretHash)); `verif-hash` / `x-verif-hash` is the legacy V3 static
 * header (raw value == secret hash). Constant-time compare, fail closed — the
 * raw request body must be hashed, never the parsed JSON.
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
// Credential sanity checks
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Connection test
// ---------------------------------------------------------------------------

export type FwTestResult = {
  ok: boolean;
  code: "ok" | "invalid_key" | "format" | "none" | "network" | "timeout" | "server" | string;
  message: string;
  mode: "test" | "live" | "";
};

/** Prove V3 credentials work: read from the payments endpoint with the Secret Key. */
export async function testFlutterwaveConnection(opts: {
  secretKey?: string;
  environment?: "test" | "live" | "";
}): Promise<FwTestResult> {
  const config = await getFlutterwaveConfig();
  const secret = opts.secretKey?.trim() || config.secretKey;
  const mode: "test" | "live" | "" = opts.environment || config.environment;

  if (!secret) {
    return {
      ok: false,
      code: "none",
      message: "No Flutterwave V3 Secret Key is configured yet. Paste your Secret Key (FLWSECK-…) above (or set FLUTTERWAVE_SECRET_KEY in the environment), then test.",
      mode,
    };
  }
  if (!isPlausibleFlutterwaveKey("secret_key", secret)) {
    return {
      ok: false,
      code: "format",
      message:
        "That doesn't look like a Flutterwave v3 Secret Key (it should start with FLWSECK-… or FLWSECK_TEST-…). The v4 Client ID/Secret are not accepted here. The value was NOT sent to Flutterwave.",
      mode,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let res: Response | null = null;
  try {
    res = await fetch(`${flutterwaveApiBaseUrl(mode)}/payments`, {
      headers: v3Headers(secret),
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
      message: `Flutterwave rejected these credentials as invalid (HTTP ${res.status}). Double-check the key was copied fully and matches the selected ${mode || ""} environment (test keys are FLWSECK_TEST-…).`,
    };
  }
  return {
    ok: false,
    code: "server",
    mode,
    message: `Flutterwave returned HTTP ${res.status}. The key may be valid, but the account needs attention (for example, disabled or unauthorized).`,
  };
}