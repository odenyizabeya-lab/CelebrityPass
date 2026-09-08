/**
 * Single publish pipeline — takes a queue item and does the real work with the
 * platform's official API, then persists the outcome and an audit log row.
 *
 * Nothing here returns token material to callers; `detail` strings are the
 * provider's own error text, scrubbed of credentials.
 */

import { prisma } from "@/lib/db";
import { getAdapter } from "./adapter";
import { getAccountCredentials } from "./oauth";
import { resolveMediaRefs } from "./media";
import { getSocialConfig } from "./db";
import { PLATFORM_META } from "./registry";
import { encryptToken } from "./crypto";
import type { PublishPayload } from "./types";

export interface PublishOutcome {
  state: "PUBLISHED" | "FAILED";
  error?: string;
  externalPostId?: string;
  externalUrl?: string;
  requiresApproval?: boolean;
}

/** Publish one queue item through the platform's official API. */
export async function publishQueueItem(queueItemId: string): Promise<PublishOutcome> {
  const config = await getSocialConfig();
  const item = await prisma.socialQueueItem.findUnique({
    where: { id: queueItemId },
    include: { account: true, platform: true },
  });
  if (!item) return { state: "FAILED", error: "Queue item not found." };

  const account = item.account ?? (await findFallbackAccount(item.platformKey));
  if (!account) {
    const msg = `No connected ${item.platform.name} account. Connect one in Marketing → Connected Accounts.`;
    return failItem(item, msg, item.attempts + 1, config.maxRetries);
  }

  const creds = await getAccountCredentials(account.id);
  if (!creds) {
    const msg = `${item.platform.name} account has no usable access token (removed or corrupted). Re-connect the account.`;
    return failItem(item, msg, item.attempts + 1, config.maxRetries);
  }

  // Refresh an expired token if a refresh token is available.
  if (creds.tokenExpiresAt && creds.tokenExpiresAt.getTime() < Date.now() && creds.refreshToken) {
    const refreshed = await refreshAccountToken(account.id);
    if (refreshed) {
      const fresh = await getAccountCredentials(account.id);
      if (fresh) Object.assign(creds, fresh);
    }
  }

  const media = await resolveMediaRefs(item.mediaJson ? JSON.parse(item.mediaJson) : []);
  const payload: PublishPayload = {
    caption: item.caption ?? item.title,
    title: item.title,
    linkUrl: item.linkUrl ?? undefined,
    media,
    contentType: item.contentType,
    contentRefId: item.contentRefId ?? undefined,
  };

  let result;
  try {
    const adapter = getAdapter(item.platformKey as never);
    result = await adapter.publish(creds, payload);
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  await prisma.socialPostLog.create({
    data: {
      queueItemId: item.id,
      platformKey: item.platformKey,
      level: result.ok ? "success" : "error",
      message: result.ok ? "Published successfully" : `Publish failed: ${result.error ?? "unknown error"}`,
      status: result.ok ? "PUBLISHED" : "FAILED",
      detail: result.detail ?? null,
    },
  });

  if (result.ok) {
    await prisma.socialQueueItem.update({
      where: { id: item.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        externalPostId: result.externalPostId ?? null,
        externalUrl: result.externalUrl ?? null,
        lastError: null,
      },
    });
    await prisma.socialPost.create({
      data: {
        queueItemId: item.id,
        platformKey: item.platformKey,
        accountId: account.id,
        title: item.title,
        caption: item.caption ?? item.title,
        mediaJson: item.mediaJson ?? null,
        linkUrl: item.linkUrl ?? null,
        contentType: item.contentType,
        source: normalizeSource(item.source),
        externalPostId: result.externalPostId ?? null,
        externalUrl: result.externalUrl ?? null,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    return { state: "PUBLISHED", externalPostId: result.externalPostId, externalUrl: result.externalUrl };
  }

  const attempts = item.attempts + 1;
  const maxAttempts = item.maxAttempts > 0 ? item.maxAttempts : config.maxRetries;
  const willRetry = attempts < maxAttempts && !result.requiresApproval;

  await prisma.socialQueueItem.update({
    where: { id: item.id },
    data: {
      attempts,
      status: willRetry ? "QUEUED" : "FAILED",
      nextAttemptAt: willRetry ? new Date(Date.now() + config.retryBackoffMinutes * 60_000) : null,
      lastError: result.error ?? null,
    },
  });

  if (!willRetry) {
    await prisma.socialPost.create({
      data: {
        queueItemId: item.id,
        platformKey: item.platformKey,
        accountId: account.id,
        title: item.title,
        caption: item.caption ?? item.title,
        mediaJson: item.mediaJson ?? null,
        linkUrl: item.linkUrl ?? null,
        contentType: item.contentType,
        source: normalizeSource(item.source),
        status: "FAILED",
        error: result.error ?? null,
      },
    });
  }
  return {
    state: "FAILED",
    error: result.error ?? "Publish failed",
    requiresApproval: result.requiresApproval,
  };
}

/** Refresh an account token using the adapter's refresh flow. Returns success. */
export async function refreshAccountToken(accountId: string): Promise<boolean> {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) return false;
  const adapter = getAdapter(account.platformKey as never);
  const creds = await getAccountCredentials(accountId);
  if (!creds?.refreshToken) return false;
  const meta = PLATFORM_META[account.platformKey as never];
  const clientId = process.env[meta.credentialEnvKeys[0]] ?? "";
  const clientSecret = process.env[meta.credentialEnvKeys[1]] ?? "";
  try {
    const tokens = await adapter.refreshToken({ clientId, clientSecret, refreshToken: creds.refreshToken });
    const newExpiry = tokens.expiresInSeconds ? new Date(Date.now() + tokens.expiresInSeconds * 1000) : null;
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        tokenEncrypted: encryptToken(tokens.accessToken),
        refreshTokenEncrypted: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
        tokenExpiresAt: newExpiry,
        lastCheckedAt: new Date(),
        status: newExpiry && newExpiry.getTime() < Date.now() ? "expired" : "connected",
      },
    });
    return true;
  } catch {
    return false;
  }
}

async function findFallbackAccount(platformKey: string) {
  return prisma.socialAccount.findFirst({
    where: { platformKey, isConnected: true },
    orderBy: { createdAt: "asc" },
  });
}

async function failItem(item: { id: string; platformKey: string }, msg: string, attempts: number, maxRetries: number): Promise<PublishOutcome> {
  await prisma.socialPostLog.create({
    data: { queueItemId: item.id, platformKey: item.platformKey, level: "error", message: msg, status: "FAILED" },
  });
  const final = attempts >= maxRetries;
  await prisma.socialQueueItem.update({
    where: { id: item.id },
    data: { status: final ? "FAILED" : "QUEUED", lastError: msg, attempts, nextAttemptAt: final ? null : new Date(Date.now() + 30 * 60_000) },
  });
  return { state: "FAILED", error: msg };
}

function normalizeSource(s: string): "AUTO" | "MANUAL" | "PROMO" {
  return s === "AUTO" || s === "MANUAL" || s === "PROMO" ? s : "MANUAL";
}

export type { PublishPayload };