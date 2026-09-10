/**
 * Persistent email queue.
 *
 * Every customer-facing email is written to the `EmailMessage` table first
 * (with a unique `dedupeKey`, so the same logical event can only ever be
 * queued once — replaying a payment webhook cannot create a second
 * confirmation). A background worker then sends due messages in small
 * batches, retries temporary failures up to `maxAttempts` (default 3) with
 * backoff, classifies permanent failures so they stop, records provider
 * message IDs, and keeps processing even when an individual message fails.
 */
import { prisma } from "@/lib/db";
import { isUniqueViolation } from "@/lib/dedupe";
import { EmailProviderError, sendViaResend } from "./provider";

export const OUTBOX_LIMIT = 50;

// Backoff between retry attempts (attempt #1 fail -> +1min, #2 -> +10min).
const RETRY_DELAYS_MS = [60_000, 10 * 60_000, 60 * 60_000];

export type EnqueueInput = {
  fanId?: string | null;
  announcementId?: string | null;
  dedupeKey: string;
  type: string;
  to: string;
  subject: string;
  template: string;
  html: string;
  from?: string;
  maxAttempts?: number;
  scheduleFor?: Date;
};

/**
 * Idempotent enqueue. If a message with the same `dedupeKey` already exists
 * (sent, pending, or failed) the existing row is returned and nothing is
 * inserted — the foundation of "never send the same email twice".
 */
export async function enqueueEmail(
  input: EnqueueInput,
): Promise<Awaited<ReturnType<typeof prisma.emailMessage.create>> | null> {
  const existing = await prisma.emailMessage.findUnique({ where: { dedupeKey: input.dedupeKey } });
  if (existing) return existing;

  try {
    return await prisma.emailMessage.create({
      data: {
        fanId: input.fanId ?? null,
        announcementId: input.announcementId ?? null,
        dedupeKey: input.dedupeKey,
        type: input.type,
        to: input.to,
        from: input.from ?? null,
        subject: input.subject,
        template: input.template,
        htmlBody: input.html,
        maxAttempts: input.maxAttempts ?? 3,
        nextAttemptAt: input.scheduleFor ?? new Date(),
      },
    });
  } catch (err) {
    // Race between two concurrent enqueues of the same event.
    if (isUniqueViolation(err)) {
      return prisma.emailMessage.findUnique({ where: { dedupeKey: input.dedupeKey } });
    }
    throw err;
  }
}

/** Claim + send a batch of due messages. One failure never blocks the batch. */
export async function processEmailQueue(batchSize = OUTBOX_LIMIT): Promise<{ claimed: number; sent: number; failed: number }> {
  const now = new Date();

  const due = await prisma.emailMessage.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: now },
      attempts: { lt: 3 },
    },
    take: batchSize,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (due.length === 0) return { claimed: 0, sent: 0, failed: 0 };

  // Atomic claim: only the PENDING/FAILED rows that were selected move to
  // SENDING. A concurrent worker cannot double-send the same row.
  const update = await prisma.emailMessage.updateMany({
    where: { id: { in: due.map((d) => d.id) }, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "SENDING", lastError: null },
  });
  if (update.count === 0) return { claimed: 0, sent: 0, failed: 0 };

  const claimed = await prisma.emailMessage.findMany({
    where: { id: { in: due.map((d) => d.id) }, status: "SENDING" },
    select: { id: true, to: true, subject: true, htmlBody: true, from: true, attempts: true, maxAttempts: true, announcementId: true },
  });

  let sent = 0;
  let failed = 0;
  for (const m of claimed) {
    try {
      const result = await sendViaResend({
        to: m.to,
        from: m.from ?? undefined,
        subject: m.subject,
        html: m.htmlBody,
      });
      await prisma.emailMessage.update({
        where: { id: m.id },
        data: {
          status: "SENT",
          sentAt: now,
          providerMessageId: result.providerMessageId,
          attempts: m.attempts + 1,
          lastError: null,
        },
      });
      sent++;
      if (m.announcementId) await bumpAnnouncement(m.announcementId, "sent");
    } catch (err) {
      const e = err instanceof EmailProviderError ? err : new EmailProviderError(err instanceof Error ? err.message : String(err), { permanent: false });
      const attempts = m.attempts + 1;
      if (e.permanent || attempts >= Math.max(m.maxAttempts, 1)) {
        await prisma.emailMessage.update({
          where: { id: m.id },
          data: { status: "PERMANENT_FAILED", attempts, lastError: e.message, sentAt: null },
        });
        failed++;
        if (m.announcementId) await bumpAnnouncement(m.announcementId, "failed");
      } else {
        await prisma.emailMessage.update({
          where: { id: m.id },
          data: {
            status: "FAILED",
            attempts,
            lastError: e.message,
            nextAttemptAt: new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]),
          },
        });
        failed++; // counts as an attempted-but-not-yet-delivered message
      }
    }
  }
  return { claimed: claimed.length, sent, failed };
}

async function bumpAnnouncement(announcementId: string, field: "sent" | "failed") {
  try {
    await prisma.emailAnnouncement.update({
      where: { id: announcementId },
      data: field === "sent" ? { sentCount: { increment: 1 } } : { failedCount: { increment: 1 } },
    });
  } catch {
    // announcement may have been deleted — ignore.
  }
}

/** Record a provider "delivered" event (from the webhook). */
export async function markEmailDelivered(providerMessageId: string, at: Date) {
  const row = await prisma.emailMessage.findFirst({ where: { providerMessageId } });
  if (!row || row.status === "DELIVERED") return;
  await prisma.emailMessage.update({
    where: { id: row.id },
    data: { status: "DELIVERED", deliveredAt: at, openedAt: row.openedAt ?? undefined },
  });
}

/** Record a provider "opened" event. */
export async function markEmailOpened(providerMessageId: string, at: Date) {
  const row = await prisma.emailMessage.findFirst({ where: { providerMessageId } });
  if (!row || row.openedAt) return;
  await prisma.emailMessage.update({
    where: { id: row.id },
    data: { openedAt: at, status: row.status === "PENDING" ? "SENT" : row.status },
  });
}

/** Record a hard bounce / complaint (permanent). */
export async function markEmailBounced(providerMessageId: string, reason: string) {
  const row = await prisma.emailMessage.findFirst({ where: { providerMessageId } });
  if (!row) return;
  await prisma.emailMessage.update({
    where: { id: row.id },
    data: { status: "PERMANENT_FAILED", lastError: `Bounced: ${reason}` },
  });
}