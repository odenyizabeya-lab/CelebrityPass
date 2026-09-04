/**
 * Email notification system.
 *
 * Uses Resend (https://resend.com) for transactional emails. The API key is
 * stored in the AppSetting DB table via the admin UI (/admin/notifications).
 * Falls back to the RESEND_API_KEY env var.
 *
 * If no email provider is configured, all send calls silently succeed but
 * produce a console warning. This prevents the app from breaking while emails
 * are not yet set up.
 */
import { prisma } from "./db";

let resendClient: { emails: { send: (args: { from: string; to: string[]; subject: string; html: string }) => Promise<{ id: string }> } } | null = null;

async function getApiKey(): Promise<string> {
  const setting = await prisma.appSetting.findUnique({ where: { key: "RESEND_API_KEY" } });
  if (setting?.value) return setting.value;
  return process.env.RESEND_API_KEY ?? "";
}

async function getClient() {
  if (resendClient) return resendClient;
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  // Dynamic import to avoid build errors when Resend is not installed.
  // We use a simple fetch-based approach instead.
  resendClient = {
    emails: {
      async send(args) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: args.from,
            to: args.to,
            subject: args.subject,
            html: args.html,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.message ?? `Email send failed (${res.status})`);
        }

        const data = (await res.json()) as { id: string };
        return data;
      },
    },
  };
  return resendClient;
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0b0c10;font-family:system-ui,-apple-system,sans-serif;color:#e4e4e7;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="margin-bottom:24px;">
      <span style="font-size:14px;font-weight:700;letter-spacing:0.1em;color:#8b5cf6;">FAN CARD</span>
    </div>
    ${body}
    <hr style="border:none;border-top:1px solid #27272a;margin:32px 0;">
    <p style="font-size:12px;color:#71717a;">Fan Card Platform · This is a transactional email.</p>
  </div>
</body>
</html>`;
}

function cardIssuedHtml(data: {
  fanName: string;
  celebrityName: string;
  membershipName: string | null;
  cardNumber: string;
  cardUrl: string;
}): string {
  return wrap(`
    <h1 style="font-size:24px;font-weight:900;color:#ffffff;margin:0 0 16px;">Your Fan Card is ready!</h1>
    <p style="font-size:15px;color:#a1a1aa;margin:0 0 24px;">Hi ${data.fanName}, welcome to the ${data.celebrityName} community.</p>
    <div style="background:#1c1917;border:1px solid #27272a;border-radius:16px;padding:24px;margin:0 0 24px;">
      <p style="font-size:12px;color:#71717a;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.1em;">Fan Card</p>
      <p style="font-size:20px;font-weight:900;color:#8b5cf6;margin:0 0 4px;">${data.cardNumber}</p>
      ${data.membershipName ? `<p style="font-size:13px;color:#a1a1aa;margin:0;">${data.membershipName} Member</p>` : ""}
    </div>
    <a href="${data.cardUrl}" style="display:inline-block;background:#8b5cf6;color:#ffffff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;">View Your Card</a>
  `);
}

function orderConfirmedHtml(data: {
  customerName: string;
  orderRef: string;
  eventName: string;
  totalCents: number;
  currency: string;
  items: { ticketName: string; quantity: number; subtotalCents: number }[];
  orderUrl: string;
}): string {
  const itemsHtml = data.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #27272a;font-size:14px;color:#e4e4e7;">${i.quantity}× ${i.ticketName}</td>
          <td style="padding:8px 0;border-bottom:1px solid #27272a;font-size:14px;color:#e4e4e7;text-align:right;">${formatCents(i.subtotalCents, data.currency)}</td>
        </tr>`,
    )
    .join("");

  return wrap(`
    <h1 style="font-size:24px;font-weight:900;color:#ffffff;margin:0 0 16px;">Order Confirmed ✓</h1>
    <p style="font-size:15px;color:#a1a1aa;margin:0 0 24px;">Hi ${data.customerName}, your order <strong style="color:#ffffff;">${data.orderRef}</strong> for <strong style="color:#ffffff;">${data.eventName}</strong> has been confirmed.</p>
    <div style="background:#1c1917;border:1px solid #27272a;border-radius:16px;padding:24px;margin:0 0 24px;">
      <table style="width:100%;border-collapse:collapse;">
        ${itemsHtml}
        <tr>
          <td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#ffffff;">Total</td>
          <td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#8b5cf6;text-align:right;">${formatCents(data.totalCents, data.currency)}</td>
        </tr>
      </table>
    </div>
    <a href="${data.orderUrl}" style="display:inline-block;background:#8b5cf6;color:#ffffff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;">View Order</a>
  `);
}

function bankTransferPendingHtml(data: {
  customerName: string;
  orderRef: string;
  eventName: string;
  totalCents: number;
  currency: string;
  orderUrl: string;
}): string {
  return wrap(`
    <h1 style="font-size:24px;font-weight:900;color:#ffffff;margin:0 0 16px;">Transfer Received</h1>
    <p style="font-size:15px;color:#a1a1aa;margin:0 0 24px;">Hi ${data.customerName}, we've received your bank transfer details for order <strong style="color:#ffffff;">${data.orderRef}</strong>.</p>
    <div style="background:#1c1917;border:1px solid #27272a;border-radius:16px;padding:24px;margin:0 0 24px;">
      <p style="font-size:13px;color:#71717a;margin:0 0 8px;">Order</p>
      <p style="font-size:14px;color:#e4e4e7;margin:0 0 12px;">${data.orderRef} — ${data.eventName}</p>
      <p style="font-size:13px;color:#71717a;margin:0 0 8px;">Amount</p>
      <p style="font-size:14px;color:#e4e4e7;margin:0;">${formatCents(data.totalCents, data.currency)}</p>
    </div>
    <div style="background:#422006;border:1px solid #92400e;border-radius:12px;padding:16px;margin:0 0 24px;">
      <p style="font-size:13px;color:#fbbf24;margin:0;">Your order is pending verification. We'll confirm once the transfer is verified against our bank statement.</p>
    </div>
    <a href="${data.orderUrl}" style="display:inline-block;background:#8b5cf6;color:#ffffff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;">View Order</a>
  `);
}

function refundProcessedHtml(data: {
  customerName: string;
  orderRef: string;
  eventName: string;
  totalCents: number;
  currency: string;
}): string {
  return wrap(`
    <h1 style="font-size:24px;font-weight:900;color:#ffffff;margin:0 0 16px;">Refund Processed</h1>
    <p style="font-size:15px;color:#a1a1aa;margin:0 0 24px;">Hi ${data.customerName}, your refund for order <strong style="color:#ffffff;">${data.orderRef}</strong> (${data.eventName}) has been processed.</p>
    <div style="background:#1c1917;border:1px solid #27272a;border-radius:16px;padding:24px;margin:0 0 24px;">
      <p style="font-size:13px;color:#71717a;margin:0 0 8px;">Refund Amount</p>
      <p style="font-size:20px;font-weight:900;color:#8b5cf6;margin:0;">${formatCents(data.totalCents, data.currency)}</p>
    </div>
  `);
}

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Public send functions
// ---------------------------------------------------------------------------

async function send(to: string[], subject: string, html: string) {
  const client = await getClient();
  if (!client) {
    console.warn("[email] No email provider configured. Skipping:", subject);
    return;
  }

  const from = (await prisma.appSetting.findUnique({ where: { key: "EMAIL_FROM" } }))?.value ?? "Fan Card <noreply@fancard.app>";

  try {
    await client.emails.send({ from, to, subject, html });
  } catch (err) {
    console.error("[email] Failed to send:", subject, err);
  }
}

/** Send when a fan card is issued (free tier or after payment). */
export async function notifyCardIssued(input: {
  to: string;
  fanName: string;
  celebrityName: string;
  membershipName: string | null;
  cardNumber: string;
  cardUrl: string;
}) {
  await send(
    [input.to],
    `Your ${input.celebrityName} Fan Card is ready!`,
    cardIssuedHtml(input),
  );
}

/** Send when a ticket order is confirmed (payment succeeded). */
export async function notifyOrderConfirmed(input: {
  to: string;
  customerName: string;
  orderRef: string;
  eventName: string;
  totalCents: number;
  currency: string;
  items: { ticketName: string; quantity: number; subtotalCents: number }[];
  orderUrl: string;
}) {
  await send(
    [input.to],
    `Order ${input.orderRef} confirmed — ${input.eventName}`,
    orderConfirmedHtml(input),
  );
}

/** Send when a bank transfer proof is submitted. */
export async function notifyBankTransferPending(input: {
  to: string;
  customerName: string;
  orderRef: string;
  eventName: string;
  totalCents: number;
  currency: string;
  orderUrl: string;
}) {
  await send(
    [input.to],
    `Transfer received for ${input.orderRef} — pending verification`,
    bankTransferPendingHtml(input),
  );
}

/** Send when a refund has been processed. */
export async function notifyRefundProcessed(input: {
  to: string;
  customerName: string;
  orderRef: string;
  eventName: string;
  totalCents: number;
  currency: string;
}) {
  await send(
    [input.to],
    `Refund processed for ${input.orderRef}`,
    refundProcessedHtml(input),
  );
}
