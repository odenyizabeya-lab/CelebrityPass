import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { markEmailDelivered, markEmailBounced, markEmailOpened } from "@/lib/emails/queue";

export const dynamic = "force-dynamic";

function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Resend webhook receiver (delivery/open/bounce/complaint events).
 * Idempotent via the WebhookEvent ledger: every event id is recorded once,
 * so a provider retry or a duplicate delivery can never be processed twice.
 * Signature-verified when RESEND_WEBHOOK_SIGNING_SECRET is set.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();

  const secret = process.env.RESEND_WEBHOOK_SIGNING_SECRET;
  if (secret) {
    const signature = request.headers.get("x-resend-signature") ?? "";
    const bodySecret = JSON.parse(raw).body?.signature ?? "";
    if (!timingSafeEqualStr(bodySecret, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: {
    data?: Array<{ id: string; type: string; created_at: string; data?: { message_id?: string; email_id?: string; bounce?: Record<string, unknown> } }>;
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(payload.data)) return NextResponse.json({ ok: true });

  for (const event of payload.data) {
    if (!event?.id || !event.type || !event?.data) continue;
    const messageId = event.data.message_id ?? event.data.email_id ?? "";

    // Claim this event exactly once.
    const claimed = await prisma.webhookEvent.createMany({
      data: [
        {
          provider: "resend",
          eventId: event.id,
          type: event.type,
          payload: JSON.stringify(event),
          handledAt: null,
        },
      ],
      skipDuplicates: true,
    });

    if (claimed.count === 0) continue; // already handled — ignore replay

    if (messageId) {
      if (event.type === "email.delivered") {
        await markEmailDelivered(messageId, new Date(event.created_at || Date.now()));
      } else if (event.type === "email.opened") {
        await markEmailOpened(messageId, new Date(event.created_at || Date.now()));
      } else if (event.type === "email.bounced" || event.type === "email.complained") {
        await markEmailBounced(messageId, event.type.replace("email.", ""));
      }
    }
    await prisma.webhookEvent.update({
      where: { eventId: event.id },
      data: { handledAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}