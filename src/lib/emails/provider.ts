/**
 * Email provider layer.
 *
 * Sends through Resend (https://resend.com) using the API key configured in
 * the admin dashboard (stored in the AppSetting table, fallback to the
 * RESEND_API_KEY env var). The key is only ever read server-side — it is
 * never shipped to the browser.
 *
 * Errors are classified as PERMANENT (4xx — stop retrying) or TEMPORARY
 * (5xx / network — retry later), so the queue never spins forever on a bad
 * recipient yet keeps retrying genuine provider hiccups.
 */
import { prisma } from "@/lib/db";

const RESEND_API = "https://api.resend.com";
const RESEND_SEND_URL = `${RESEND_API}/emails`;

export class EmailProviderError extends Error {
  readonly permanent: boolean;
  readonly status?: number;
  constructor(message: string, opts: { permanent: boolean; status?: number }) {
    super(message);
    this.name = "EmailProviderError";
    this.permanent = opts.permanent;
    this.status = opts.status;
  }
}

export type SendResult = { providerMessageId: string };

/** Resolve the configured Resend API key (DB first, then env). */
export async function getEmailApiKey(): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: "RESEND_API_KEY" } });
  return row?.value || process.env.RESEND_API_KEY || "";
}

/** Resolve the configured From address. */
export async function getEmailFrom(): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: "EMAIL_FROM" } });
  return row?.value || process.env.EMAIL_FROM || "CelebrityPass <noreply@celebritypass.app>";
}

/** True when a real provider is configured (emails leave the queue). */
export async function isEmailProviderConfigured(): Promise<boolean> {
  return (await getEmailApiKey()).length > 0;
}

export type Headers = Record<string, string>;

/**
 * Send one email through Resend. Throws `EmailProviderError` classified as
 * permanent or temporary so the queue can decide whether to keep retrying.
 */
export async function sendViaResend(input: {
  to: string;
  from?: string;
  subject: string;
  html: string;
  headers?: Headers;
}): Promise<SendResult> {
  const apiKey = await getEmailApiKey();
  if (!apiKey) {
    // Treat "not configured" as RETRYABLE, not permanent: once the admin adds
    // the key, queued mail must go out instead of being dead forever.
    throw new EmailProviderError("No email provider configured (RESEND_API_KEY is empty).", {
      permanent: false,
    });
  }

  const payload: Record<string, unknown> = {
    from: input.from ?? (await getEmailFrom()),
    to: [input.to],
    subject: input.subject,
    html: input.html,
  };
  if (input.headers && Object.keys(input.headers).length) payload.headers = input.headers;

  let res: Response;
  try {
    res = await fetch(RESEND_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new EmailProviderError(
      `Network error reaching email provider: ${err instanceof Error ? err.message : String(err)}`,
      { permanent: false },
    );
  }

  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    const detail = body?.message ?? body?.name ?? `HTTP ${res.status}`;
    const permanent = res.status >= 400 && res.status < 500;
    throw new EmailProviderError(detail, { permanent, status: res.status });
  }

  return { providerMessageId: body.id ?? "" };
}

/**
 * Query Resend for the sending domains so the Email Center can show whether
 * celebritypass.app is authenticated (SPF / DKIM / DMARC records). Returns
 * null when no API key is configured.
 */
export async function getResendDomainsStatus(): Promise<{
  configured: boolean;
  domains: Array<{
    id: string;
    name: string;
    status: string;
    records: Array<{ type: string; name: string; value: string; status: string }>;
  }>;
} | null> {
  const apiKey = await getEmailApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(`${RESEND_API}/domains`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ id: string; name: string; status: string; records?: Array<{ type: string; name: string; value: string; status: string }> }> };
    return {
      configured: true,
      domains: (data?.data ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        records: d.records ?? [],
      })),
    };
  } catch {
    return null;
  }
}