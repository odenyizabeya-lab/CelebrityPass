/**
 * Read-only service helpers for the admin dashboard. Never decrypt tokens here —
 * accounts are always returned with masked token fingerprints only.
 */

import { prisma } from "@/lib/db";
import { PLATFORM_META } from "./registry";
import { maskSecret, decryptToken } from "./crypto";
import { ensureSocialSeed } from "./db";
import { getNextRunInfo } from "./scheduler";
import { tryParseJson } from "@/lib/utils";

/** Safe account shape for the UI. */
export interface PublicAccount {
  id: string;
  platformKey: string;
  platformName: string;
  platformColor: string;
  username: string | null;
  url: string | null;
  accountType: string | null;
  scopes: string[];
  status: string;
  isConnected: boolean;
  lastError: string | null;
  lastCheckedAt: Date | null;
  tokenExpiresAt: Date | null;
  tokenMask: string;
  hasRefreshToken: boolean;
}

/** Safe platform shape for the UI. */
export interface PublicPlatform {
  key: string;
  name: string;
  color: string;
  oauth: boolean;
  enabled: boolean;
  supportsText: boolean;
  supportsImage: boolean;
  supportsVideo: boolean;
  requiresApproval: boolean;
  approvalStatus: string;
  approvalNote: string | null;
  hasCredentials: boolean;
  credentialEnvKeys: string[];
  configuredEnv: boolean;
  apiStatus: string;
  apiNote: string | null;
  authUrl: string;
  scopes: string[];
  howToConnect: string;
  accounts: PublicAccount[];
}

export async function getOverviewStats() {
  const [platforms, accounts, queue, posts, failed, logs, approvals, config] = await Promise.all([
    prisma.socialPlatform.count(),
    prisma.socialAccount.count({ where: { isConnected: true } }),
    prisma.socialQueueItem.count(),
    prisma.socialPost.count(),
    prisma.socialPost.count({ where: { status: "FAILED" } }),
    prisma.socialPostLog.count(),
    prisma.socialQueueItem.count({ where: { status: "APPROVAL_REQUIRED" } }),
    prisma.socialConfig.findUnique({ where: { id: 1 } }),
  ]);

  const [published, publishedToday] = await Promise.all([
    prisma.socialPost.count({ where: { status: "PUBLISHED" } }),
    prisma.socialPost.count({ where: { status: "PUBLISHED", publishedAt: { gte: startOfToday() } } }),
  ]);

  const nextRun = await getNextRunInfo();

  return {
    platforms,
    connectedAccounts: accounts,
    queueSize: queue,
    approvals: approvals,
    totalPosts: posts,
    published,
    publishedToday,
    failed,
    logs,
    automationEnabled: config?.automationEnabled ?? false,
    paused: config?.paused ?? false,
    approvalMode: config?.approvalMode ?? "auto",
    maxPostsPerDay: config?.maxPostsPerDay ?? 10,
    nextRun,
  };
}

export async function getPublicPlatforms(): Promise<PublicPlatform[]> {
  await ensureSocialSeed().catch(() => undefined);
  const rows = await prisma.socialPlatform.findMany({ orderBy: { displayOrder: "asc" } });
  const accounts = await prisma.socialAccount.findMany({
    where: { isConnected: true },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => {
    const meta = PLATFORM_META[row.key as never] ?? null;
    const accountRows = accounts.filter((a) => a.platformKey === row.key);
    return {
      key: row.key,
      name: row.name,
      color: row.color,
      oauth: meta?.oauth ?? row.authUrl !== null,
      enabled: row.enabled,
      supportsText: row.supportsText,
      supportsImage: row.supportsImage,
      supportsVideo: row.supportsVideo,
      requiresApproval: row.requiresApproval,
      approvalStatus: row.approvalStatus,
      approvalNote: row.approvalNote,
      hasCredentials: row.hasCredentials,
      credentialEnvKeys: tryParseJson(row.credentialEnvKeysJson, []),
      configuredEnv: (meta?.credentialEnvKeys ?? []).every((k) => Boolean(process.env[k])),
      apiStatus: row.apiStatus,
      apiNote: row.apiNote,
      authUrl: row.authUrl ?? "",
      scopes: tryParseJson(row.scopesJson, []),
      howToConnect: meta?.howToConnect ?? "",
      accounts: accountRows.map((a) => ({
        id: a.id,
        platformKey: a.platformKey,
        platformName: row.name,
        platformColor: row.color,
        username: a.externalUsername,
        url: a.externalUrl,
        accountType: a.accountType,
        scopes: tryParseJson(a.scopes, []),
        status: a.status,
        isConnected: a.isConnected,
        lastError: a.lastError,
        lastCheckedAt: a.lastCheckedAt,
        tokenExpiresAt: a.tokenExpiresAt,
        tokenMask: maskSecret(decryptToken(a.tokenEncrypted)),
        hasRefreshToken: Boolean(a.refreshTokenEncrypted),
      })),
    };
  });
}

/** Scrub a token value to a short fingerprint (for logs/UI). */
export { maskSecret };

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Load content lists for the manual composer + eligibility toggles. */
export async function getEligibleContent(scope: "eligible" | "all" = "all") {
  const where = scope === "eligible" ? { socialAutoPost: true } : {};
  const [celebrities, memberships, events, articles] = await Promise.all([
    prisma.celebrity.findMany({
      where: { ...where, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, profileImage: true, socialAutoPost: true },
    }),
    prisma.membershipLevel.findMany({
      where: { ...where, isActive: true },
      orderBy: { name: "asc" },
      include: { celebrity: { select: { name: true } } },
    }),
    prisma.celebrityEvent.findMany({
      where: { ...where },
      orderBy: { startAt: "desc" },
      include: { celebrity: { select: { name: true } } },
      take: 200,
    }),
    prisma.socialArticle.findMany({
      where: scope === "eligible" ? { ...where, status: "PUBLISHED" } : {},
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    celebrities: celebrities.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      image: c.profileImage,
      autoPost: c.socialAutoPost,
      label: "Celebrity",
    })),
    memberships: memberships.map((m) => ({
      id: m.id,
      name: `${m.name} · ${m.celebrity.name}`,
      autoPost: m.socialAutoPost,
      label: "Product",
      price: m.price,
      currency: m.currency,
    })),
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      autoPost: e.socialAutoPost,
      label: "Event",
      when: e.startAt ? e.startAt.toISOString() : null,
    })),
    articles: articles.map((a) => ({
      id: a.id,
      name: a.title,
      autoPost: a.autoPostEnabled,
      label: "Article",
      status: a.status,
    })),
  };
}