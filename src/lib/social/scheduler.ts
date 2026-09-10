/**
 * Automatic posting scheduler engine.
 *
 * This runs server-side (triggered by the /api/social/cron endpoint from a
 * cron service, or by the admin "Run now" button). It is database-driven, so it
 * keeps working while the admin is offline.
 *
 *  1. Scan enabled per-platform schedules and generate queue items for any new
 *     eligible content (products, events, articles) since the last scan.
 *  2. Process every due queue item through the real publisher, with daily caps,
 *     dedupe and retry/backoff, and a concurrency guard per item.
 *
 * Safety: a queue item can only be claimed once (status → PROCESSING) so two
 * overlapping cron hits can never double-post the same item.
 */

import { prisma } from "@/lib/db";
import { getSocialConfig, ensureSocialSeed, type SocialConfigShape } from "./db";
import { generateNewContent } from "./content";
import { publishQueueItem } from "./publisher";
import { logActivity } from "./oauth";
import type { ContentType, PostSource } from "./types";

// In-process guard against overlapping runs (best effort; DB claim is the authority).
let runInProgress = false;

export interface RunReport {
  ran: boolean;
  reason?: string;
  generated: number;
  processed: number;
  published: number;
  failed: number;
  skipped: number;
}

/**
 * Main scheduler entry. Runs the full automatic pipeline, honoring the pause
 * flag + approval mode, enqueuing eligible content, and publishing anything
 * that is due from the queue.
 */
export async function runScheduler(): Promise<RunReport> {
  const report: RunReport = { ran: true, generated: 0, processed: 0, published: 0, failed: 0, skipped: 0 };

  try {
    await ensureSocialSeed();
  } catch {
    report.ran = false;
    report.reason = "Could not seed social configuration";
    return report;
  }

  const config = await getSocialConfig();
  if (!config.automationEnabled) {
    // Allow manual scheduled items to still fire, but no automation at all.
    await processDueItems(config, report, { automationEnabled: false });
    return report;
  }
  if (config.paused) {
    await processDueItems(config, report, { automationEnabled: false, paused: true });
    report.reason = "Automation paused — only manual scheduled posts processed.";
    return report;
  }

  if (runInProgress) {
    report.skipped += 1;
    report.reason = "A scheduler run is already in progress (concurrency guard).";
    return report;
  }
  runInProgress = true;
  try {
    await generateDueContent(config, report);
    await processDueItems(config, report, { automationEnabled: true });
  } finally {
    runInProgress = false;
  }
  return report;
}

/** 1a. Advance each due schedule and 1b. enqueue new eligible content. */
async function generateDueContent(config: SocialConfigShape, report: RunReport): Promise<void> {
  const schedules = await prisma.socialSchedule.findMany({
    where: { enabled: true },
    include: { platform: true },
  });
  const now = new Date();

  for (const schedule of schedules) {
    if (schedule.nextRunAt && schedule.nextRunAt > now) continue;
    if (!schedule.platform.enabled) continue;

    const scanStart = schedule.lastRunAt ?? new Date(0);
    const contentTypes = parseArray(schedule.contentTypesJson);
    const eligible = contentTypes.filter((c) => config.contentTypes.includes(c));

    for (const contentType of eligible) {
      const posts = await generateNewContent(contentType as ContentType, scanStart);
      for (const post of posts) {
        const exists = await prisma.socialQueueItem.findUnique({
          where: { contentKey_platformKey: { contentKey: post.contentKey, platformKey: schedule.platformKey } },
        });
        if (exists) {
          report.skipped += 1;
          continue;
        }

        const approveFirst = config.approvalMode === "approval";
        const status = approveFirst ? "APPROVAL_REQUIRED" : "QUEUED";

        await prisma.socialQueueItem.create({
          data: {
            contentKey: post.contentKey,
            platformKey: schedule.platformKey,
            contentType: post.contentType,
            contentRefId: post.contentRefId,
            title: post.title,
            caption: post.caption,
            mediaJson: post.media.length ? JSON.stringify(post.media) : null,
            linkUrl: post.linkUrl ?? null,
            source: "AUTO",
            status,
            scheduledFor: now,
            maxAttempts: config.maxRetries,
          },
        });
        report.generated += 1;
        await logActivity(schedule.platformKey, null, "info", `Auto-queued "${post.title}"`, status);
      }
    }

    const next = computeNextRun(schedule.frequency, schedule.intervalMinutes, schedule.timesJson, schedule.weekdaysJson, schedule.lastRunAt ?? now);
    await prisma.socialSchedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: now, nextRunAt: next },
    });
  }
}

/** 2. Process due queue items (QUEUED/SCHEDULED) with caps + concurrency guard. */
async function processDueItems(
  config: SocialConfigShape,
  report: RunReport,
  opts: { automationEnabled: boolean; paused?: boolean },
): Promise<void> {
  const now = new Date();
  const due = await prisma.socialQueueItem.findMany({
    where: {
      status: { in: ["QUEUED", "SCHEDULED"] },
      AND: [
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
      ],
    },
    orderBy: { scheduledFor: "asc" },
    take: 200,
  });

  // Daily cap bookkeeping per platform.
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const publishedToday = await prisma.socialPost.groupBy({
    by: ["platformKey"],
    where: { publishedAt: { gte: dayStart } },
    _count: true,
  });
  const todayCount = new Map(publishedToday.map((p) => [p.platformKey, p._count]));

  for (const item of due) {
    const isAuto = item.source === "AUTO";
    if (isAuto && !opts.automationEnabled) {
      report.skipped += 1;
      continue; // pause / disabled
    }
    if (isAuto && config.approvalMode === "approval") {
      // Held for approval — never auto-published.
      report.skipped += 1;
      continue;
    }
    if (item.attempts >= (item.maxAttempts > 0 ? item.maxAttempts : config.maxRetries)) {
      await prisma.socialQueueItem.update({ where: { id: item.id }, data: { status: "FAILED" } });
      report.failed += 1;
      continue;
    }

    // Per-schedule cap → global cap.
    const cap = await capForPlatform(item.platformKey);
    const effectiveCap = cap ?? config.maxPostsPerDay;
    const count = todayCount.get(item.platformKey) ?? 0;
    if (count >= effectiveCap) {
      report.skipped += 1;
      continue;
    }

    // Concurrency-safe claim.
    const claimed = await prisma.socialQueueItem.updateMany({
      where: { id: item.id, status: { in: ["QUEUED", "SCHEDULED"] } },
      data: { status: "PROCESSING" },
    });
    if (claimed.count === 0) {
      report.skipped += 1;
      continue; // another runner claimed it
    }

    report.processed += 1;
    const outcome = await publishQueueItem(item.id);
    if (outcome.state === "PUBLISHED") {
      report.published += 1;
      todayCount.set(item.platformKey, (todayCount.get(item.platformKey) ?? 0) + 1);
    } else {
      report.failed += 1;
    }
  }
}

async function capForPlatform(platformKey: string): Promise<number | null> {
  const schedule = await prisma.socialSchedule.findUnique({ where: { platformKey } });
  return schedule?.maxPerDay ?? null;
}

/** Compute the next fire time for a schedule. */
export function computeNextRun(
  frequency: string,
  intervalMinutes: number | null,
  timesJson: string,
  weekdaysJson: string | null,
  from: Date,
): Date {
  const now = from;
  switch (frequency) {
    case "hourly":
      return new Date(now.getTime() + (intervalMinutes || 60) * 60_000);
    case "daily":
    case "weekly": {
      const times = parseArray<string>(timesJson);
      const timeNumbers = times
        .map((t) => {
          const [h, m] = t.split(":").map((n) => parseInt(n, 10));
          return isNaN(h) ? null : { h: h || 0, m: m || 0 };
        })
        .filter((x) => x !== null) as { h: number; m: number }[];
      if (timeNumbers.length === 0) {
        return new Date(now.getTime() + 24 * 60 * 60_000); // daily default
      }
      for (let i = 1; i <= 14; i++) {
        const candidate = new Date(now.getTime() + i * 60 * 60_000 * 24);
        const h = candidate.getHours();
        const m = candidate.getMinutes();
        const dow = candidate.getUTCDay();
        const dayMatches =
          frequency === "weekly"
            ? parseArray<number>(weekdaysJson ?? "[]").includes(dow)
            : true;
        const timeMatches = timeNumbers.some((t) => t.h === h && t.m === m);
        if (dayMatches && timeMatches) return candidate;
      }
      return new Date(now.getTime() + (frequency === "weekly" ? 7 : 1) * 24 * 60 * 60_000);
    }
    case "custom":
      return new Date(now.getTime() + (intervalMinutes || 1440) * 60_000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60_000);
  }
}

/** Info for the dashboard: next schedule run + next due post. */
export async function getNextRunInfo() {
  const schedules = await prisma.socialSchedule.findMany({
    where: { enabled: true },
    include: { platform: true },
    orderBy: { nextRunAt: "asc" },
  });
  const nextSchedule = schedules.find((s) => s.nextRunAt) ?? null;
  const nextPost = await prisma.socialQueueItem.findFirst({
    where: { status: { in: ["QUEUED", "SCHEDULED", "APPROVAL_REQUIRED"] } },
    orderBy: { scheduledFor: "asc" },
    include: { platform: true },
  });
  return {
    nextSchedule: nextSchedule
      ? { platform: nextSchedule.platform.name, at: nextSchedule.nextRunAt }
      : null,
    nextPost: nextPost
      ? { id: nextPost.id, title: nextPost.title, platform: nextPost.platform.name, status: nextPost.status, at: nextPost.scheduledFor, source: nextPost.source }
      : null,
    scheduleCount: schedules.length,
  };
}

/** Parse a JSON array string tolerant of empties. */
export function parseArray<T = string>(json: string | null | undefined): T[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export type { PostSource };