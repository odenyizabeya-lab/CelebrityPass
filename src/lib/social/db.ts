/**
 * Database helpers for the social publishing system:
 *  - seed the SocialPlatform registry rows (idempotent)
 *  - ensure the singleton SocialConfig row exists
 *  - tolerant config reads
 */

import { prisma } from "@/lib/db";
import { PLATFORM_KEYS, PLATFORM_META } from "./registry";
import { seedPlatformRow } from "./oauth";
import type { PlatformKey } from "./types";
import { tryParseJson } from "@/lib/utils";

/** Idempotently ensure the platform registry + config rows exist. */
export async function ensureSocialSeed(): Promise<void> {
  for (const key of PLATFORM_KEYS) {
    const meta = PLATFORM_META[key];
    const hasCreds = meta.credentialEnvKeys.every((k) => Boolean(process.env[k]));
    await prisma.socialPlatform.upsert({
      where: { key },
      update: {
        name: meta.name,
        color: meta.color,
        supportsText: meta.capabilities.text,
        supportsImage: meta.capabilities.image,
        supportsVideo: meta.capabilities.video,
        requiresApproval: meta.requiresApproval,
        approvalStatus: meta.requiresApproval ? "required" : "not_required",
        approvalNote: meta.approvalNote,
        authUrl: meta.authUrl || null,
        tokenUrl: meta.tokenUrl || null,
        credentialEnvKeysJson: JSON.stringify(meta.credentialEnvKeys),
        hasCredentials: hasCreds,
        scopesJson: JSON.stringify(meta.scopes),
      },
      create: seedPlatformRow(key),
    });
  }

  // Default: every platform gets an (initially disabled) schedule.
  for (const key of PLATFORM_KEYS) {
    await prisma.socialSchedule.upsert({
      where: { platformKey: key },
      update: {},
      create: {
        platformKey: key,
        name: `${PLATFORM_META[key].name} schedule`,
        enabled: false,
        contentTypesJson: JSON.stringify(["celebrity", "membership", "event", "article"]),
        frequency: "daily",
        timesJson: JSON.stringify(["09:00", "18:00"]),
      },
    });
  }

  await prisma.socialConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      automationEnabled: false,
      paused: false,
      approvalMode: "auto",
      maxPostsPerDay: 10,
      maxRetries: 3,
      retryBackoffMinutes: 30,
      dedupeWindowDays: 30,
    },
  });
}

export interface SocialConfigShape {
  automationEnabled: boolean;
  paused: boolean;
  approvalMode: "auto" | "approval";
  maxPostsPerDay: number;
  maxRetries: number;
  retryBackoffMinutes: number;
  dedupeWindowDays: number;
  contentTypes: string[];
}

export async function getSocialConfig(): Promise<SocialConfigShape> {
  await ensureSocialSeed().catch(() => undefined);
  const row = await prisma.socialConfig.findUnique({ where: { id: 1 } });
  const def: SocialConfigShape = {
    automationEnabled: false,
    paused: false,
    approvalMode: "auto",
    maxPostsPerDay: 10,
    maxRetries: 3,
    retryBackoffMinutes: 30,
    dedupeWindowDays: 30,
    contentTypes: ["celebrity", "membership", "event", "article", "promo"],
  };
  if (!row) return def;
  return {
    automationEnabled: row.automationEnabled,
    paused: row.paused,
    approvalMode: (row.approvalMode as "auto" | "approval") ?? "auto",
    maxPostsPerDay: row.maxPostsPerDay,
    maxRetries: row.maxRetries,
    retryBackoffMinutes: row.retryBackoffMinutes,
    dedupeWindowDays: row.dedupeWindowDays,
    contentTypes: tryParseJson(row.contentTypesJson, def.contentTypes),
  };
}

/** Read the platform DB rows (idempotently seeded). */
export async function getPlatformRows() {
  await ensureSocialSeed().catch(() => undefined);
  return prisma.socialPlatform.findMany({ orderBy: { displayOrder: "asc" } });
}

export async function getPlatformRow(key: string) {
  await ensureSocialSeed().catch(() => undefined);
  return prisma.socialPlatform.findUnique({ where: { key } });
}

/** Whether a platform is actually publishable right now (creds + enabled). */
export async function isPlatformReady(key: PlatformKey): Promise<boolean> {
  const row = await getPlatformRow(key);
  if (!row) return false;
  return row.enabled && row.hasCredentials && row.apiStatus !== "not_configured";
}