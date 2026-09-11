/**
 * Domain senders — the single place that decides WHICH email fires for a real
 * event. Each sender enqueues (idempotently) and then nudges the queue worker
 * in the same tick, so emails leave promptly even between cron runs. Nothing
 * here blocks the caller: registration, payments and celebrity creation never
 * wait on the email provider.
 */
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getAdminEmails } from "@/lib/admin/settings";
import { appUrl, signToken } from "@/lib/utils";
import { formatMoney } from "@/lib/payments";
import { renderEmailTemplate } from "./templates";
import { enqueueEmail, processEmailQueue } from "./queue";
import { fanOutAnnouncement, type AudienceSpec } from "./audience";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Signed one-click unsubscribe URL (verified server-side on /unsubscribe). */
export function unsubscribeUrlFor(fanId: string): string {
  return `${appUrl()}/unsubscribe?fan=${encodeURIComponent(fanId)}&t=${encodeURIComponent(signToken(fanId))}`;
}

function kickWorker() {
  void processEmailQueue(25).catch(() => {});
}

/** 1. Welcome / registration confirmation (sent exactly once per fan). */
export async function sendWelcomeEmail(fan: { id: string; name: string; email: string }) {
  const { subject, html } = renderEmailTemplate({ kind: "welcome", fanName: fan.name, loginUrl: `${appUrl()}/dashboard` });
  await enqueueEmail({
    fanId: fan.id,
    dedupeKey: `welcome:${fan.id}`,
    type: "WELCOME",
    to: fan.email,
    subject,
    template: "welcome",
    html,
  });
  kickWorker();
}

/**
 * 1+2. Full registration burst: create a one-time verification token, send
 * the welcome email AND the verification email. Idempotent per fan: the
 * welcome message is deduped on the fan id, so re-running never re-sends it.
 */
export async function sendRegistrationEmails(fan: { id: string; name: string; email: string }) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  await prisma.emailVerificationToken.create({
    data: {
      fanId: fan.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });
  await sendWelcomeEmail(fan);
  await sendEmailVerification(fan, rawToken);
}

/** 2. Email verification (once per verification token — resendable). */
export async function sendEmailVerification(fan: { id: string; name: string; email: string }, rawToken: string) {
  const tokenHash = sha256(rawToken);
  const { subject, html } = renderEmailTemplate({
    kind: "emailVerification",
    fanName: fan.name,
    verifyUrl: `${appUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`,
  });
  await enqueueEmail({
    fanId: fan.id,
    dedupeKey: `email-verify:${tokenHash}`,
    type: "EMAIL_VERIFICATION",
    to: fan.email,
    subject,
    template: "email-verification",
    html,
  });
  kickWorker();
}

/** 3. Password reset (once per reset token — resendable). */
export async function enqueuePasswordReset(input: { fan: { id: string; name: string; email: string }; resetUrl: string; tokenHash: string }) {
  const { subject, html } = renderEmailTemplate({ kind: "passwordReset", fanName: input.fan.name, resetUrl: input.resetUrl });
  await enqueueEmail({
    fanId: input.fan.id,
    dedupeKey: `password-reset:${input.tokenHash}`,
    type: "PASSWORD_RESET",
    to: input.fan.email,
    subject,
    template: "password-reset",
    html,
  });
  kickWorker();
}

/** 4. Payment confirmation with full transaction + fan-card access link. */
export async function sendPaymentReceipt(input: {
  payment: { id: string; amount: number; currency: string; gatewayRef: string | null; paidAt: Date | null };
  fan: { id: string; name: string; email: string };
  celebrityName: string;
  level: string;
  cardNumber: string;
  cardUrl: string;
}) {
  const paidAt = input.payment.paidAt ?? new Date();
  const { subject, html } = renderEmailTemplate({
    kind: "paymentReceipt",
    fanName: input.fan.name,
    amountLabel: formatMoney(input.payment.amount, input.payment.currency),
    currency: input.payment.currency,
    level: input.level,
    celebrityName: input.celebrityName,
    cardNumber: input.cardNumber,
    cardUrl: input.cardUrl,
    reference: input.payment.gatewayRef ?? input.payment.id,
    paidAtLabel: paidAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  });
  await enqueueEmail({
    fanId: input.fan.id,
    dedupeKey: `pay-receipt:${input.payment.id}`,
    type: "PAYMENT_RECEIPT",
    to: input.fan.email,
    subject,
    template: "payment-receipt",
    html,
  });
  kickWorker();
}

/** 5/6. Fan-card activated (+ membership level + access link). */
export async function sendCardActivated(input: {
  card: { id: string };
  fan: { id: string; name: string; email: string };
  celebrityName: string;
  membershipName: string | null;
  cardNumber: string;
  cardUrl: string;
}) {
  const { subject, html } = renderEmailTemplate({
    kind: "cardActivated",
    fanName: input.fan.name,
    celebrityName: input.celebrityName,
    membershipName: input.membershipName ?? "",
    cardNumber: input.cardNumber,
    cardUrl: input.cardUrl,
  });
  await enqueueEmail({
    fanId: input.fan.id,
    dedupeKey: `card-active:${input.card.id}`,
    type: "CARD_ACTIVATED",
    to: input.fan.email,
    subject,
    template: "card-activated",
    html,
  });
  kickWorker();
}

/**
 * 7. New celebrity added → announce to fans who opted into these updates.
 * One EmailAnnouncement row + one EmailMessage per eligible fan. This is a
 * real customer-facing notification (not triggered by generic admin edits).
 */
export async function sendNewCelebrityAnnouncement(celebrity: { id: string; slug: string; name: string; category: string }) {
  const audience: AudienceSpec = { type: "NEW_CELEBRITY" };
  const announcement = await prisma.emailAnnouncement.create({
    data: {
      title: `New celebrity: ${celebrity.name}`,
      audienceType: "NEW_CELEBRITY",
      template: "NEW_CELEBRITY",
      celebrityId: celebrity.id,
      subject: `${celebrity.name} is now on CelebrityPass`,
      status: "SENDING",
    },
  });

  const { targets, enqueued } = await fanOutAnnouncement({
    announcementId: announcement.id,
    audience,
    template: "NEW_CELEBRITY",
    type: "NEW_CELEBRITY",
    subject: announcement.subject,
    dedupePrefix: "newcelebrity",
    render: (fan) =>
      renderEmailTemplate({
        kind: "newCelebrity",
        fanName: fan.name,
        celebrityName: celebrity.name,
        category: celebrity.category,
        profileUrl: `${appUrl()}/celebrity/${celebrity.slug}`,
      }),
  });

  await prisma.emailAnnouncement.update({
    where: { id: announcement.id },
    data: { targetsCount: targets, enqueuedCount: enqueued },
  });
  kickWorker();
}

/** Shared announcement rendering for the admin Email Center composer. */
export { fanOutAnnouncement };
export type { AudienceSpec };

/**
 * 8. First-message chat notification. Fires once per conversation (dedupeKey
 * is permanent, so repeat messages never spam a recipient). The recipient is
 * only emailed when they are offline — someone actively chatting clearly
 * doesn't need an email. Never blocking: enqueue + kick worker.
 */
export async function sendChatMessageNotification(input: {
  direction: "toFan" | "toTeam";
  conversationId: string;
  fan?: { id: string; name: string; email: string; lastSeenAt: Date | null } | null;
  celebrityName: string;
  senderName: string;
  preview: string;
  replyUrl: string;
  replyLabel: string;
}) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  if (input.direction === "toFan") {
    const fan = input.fan;
    if (!fan) return;
    // Offline check + email hygiene: inactive or unsubscribed fans are skipped.
    if (fan.lastSeenAt && fan.lastSeenAt > fiveMinutesAgo) return;
    const { subject, html } = renderEmailTemplate({
      kind: "chatNew",
      fanName: fan.name,
      senderName: input.senderName,
      actorLabel: input.celebrityName,
      preview: input.preview,
      replyLabel: input.replyLabel,
      replyUrl: input.replyUrl,
      replyPreview: `You can reply inside the chat whenever you're ready.`,
    });
    await enqueueEmail({
      fanId: fan.id,
      dedupeKey: `chat-fan:${input.conversationId}`,
      type: "CHAT",
      to: fan.email,
      subject,
      template: "chat-new",
      html,
    });
    kickWorker();
    return;
  }

  // toTeam: notify the first configured admin address (once per conversation).
  const adminEmails = (await getAdminEmails()).filter((e) => e.length > 0);
  const to = adminEmails[0];
  if (!to) return;
  const { subject, html } = renderEmailTemplate({
    kind: "chatNew",
    fanName: "Team",
    senderName: input.senderName,
    actorLabel: "fan",
    preview: input.preview,
    replyLabel: input.replyLabel,
    replyUrl: input.replyUrl,
    replyPreview: `A fan is waiting for a reply in the team inbox.`,
  });
  await enqueueEmail({
    fanId: null,
    dedupeKey: `chat-team:${input.conversationId}`,
    type: "CHAT",
    to,
    subject,
    template: "chat-new",
    html,
  });
  kickWorker();
}