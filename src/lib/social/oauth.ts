/**
 * OAuth plumbing shared by every OAuth-based platform adapter.
 *
 * Responsibilities:
 *  - persist CSRF-safe `state` rows so callbacks can be validated
 *  - build the authorize URL with the correct redirect + scopes
 *  - exchange the authorization code for tokens and store them encrypted
 *
 * Token-entry platforms (Telegram, WhatsApp) skip OAuth entirely and go
 * straight to `saveAccountTokens`.
 */

import { prisma } from "@/lib/db";
import { PLATFORM_META } from "./registry";
import { encryptToken, decryptToken, randomState } from "./crypto";
import { appUrl } from "@/lib/utils";
import type { PlatformKey } from "./types";
import { getAdapter } from "./adapter";

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Public callback URL for a platform (used as the OAuth redirect_uri). */
export function oauthRedirectUri(platformKey: string): string {
  return `${appUrl()}/api/social/oauth/${platformKey}/callback`;
}

/** Create a persisted, expiring OAuth state row. */
export async function createOAuthState(platformKey: string, redirectTo?: string): Promise<string> {
  await prisma.socialOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const state = randomState();
  await prisma.socialOAuthState.create({
    data: { state, platformKey, redirectTo: redirectTo ?? null, expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS) },
  });
  return state;
}

/** Validate + consume an OAuth state row. */
export async function consumeOAuthState(state: string, platformKey: string): Promise<boolean> {
  const row = await prisma.socialOAuthState.findUnique({ where: { state } });
  if (!row) return false;
  if (row.usedAt) return false;
  if (row.platformKey !== platformKey) return false;
  if (row.expiresAt < new Date()) return false;
  await prisma.socialOAuthState.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return true;
}

/** Build the authorize URL for a platform (OAuth platforms only). */
export function buildAuthorizeUrl(platformKey: string, state: string): string {
  const meta = PLATFORM_META[platformKey as PlatformKey];
  const clientId = process.env[meta.credentialEnvKeys[0]] ?? "";
  const adapter = getAdapter(platformKey as PlatformKey);
  return (
    adapter.buildAuthUrl({
      clientId,
      redirectUri: oauthRedirectUri(platformKey),
      state,
      scopes: meta.scopes,
    }) ?? ""
  );
}

/** Exchange an authorization code for a token pair and upsert the account. */
export async function completeOAuthCode(
  platformKey: string,
  code: string,
): Promise<{ accountId: string }> {
  const meta = PLATFORM_META[platformKey as PlatformKey];
  const adapter = getAdapter(platformKey as PlatformKey);
  const clientId = process.env[meta.credentialEnvKeys[0]] ?? "";
  const clientSecret = process.env[meta.credentialEnvKeys[1]] ?? "";

  const tokens = await adapter.exchangeCode({
    clientId,
    clientSecret,
    redirectUri: oauthRedirectUri(platformKey),
    code,
  });

  const creds = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: tokens.expiresInSeconds
      ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
      : null,
  };

  // Verify + fetch profile identity with the fresh token.
  const verified = await adapter
    .verifyConnection(creds)
    .catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));

  return saveAccountTokens(platformKey, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: creds.tokenExpiresAt,
    externalUserId: verified.externalUserId,
    externalUsername: verified.externalUsername,
    externalUrl: verified.externalUrl,
    accountType: verified.accountType,
    rawProfile: verified.profile ? JSON.stringify(verified.profile) : undefined,
    scopes: tokens.scopes,
    verifiedOk: verified.ok,
  });
}

export interface SaveTokenInput {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date | null;
  externalUserId?: string | null;
  externalUsername?: string | null;
  externalUrl?: string | null;
  accountType?: string | null;
  rawProfile?: string | null;
  scopes?: string[];
  verifiedOk?: boolean;
}

/** Persist (encrypted) tokens for an account, creating it if needed. */
export async function saveAccountTokens(
  platformKey: string,
  input: SaveTokenInput,
): Promise<{ accountId: string }> {
  const platform = await prisma.socialPlatform.upsert({
    where: { key: platformKey },
    create: seedPlatformRow(platformKey),
    update: {},
  });

  const identity = input.externalUserId;
  const existing = identity
    ? await prisma.socialAccount.findFirst({
        where: { platformKey, externalUserId: identity },
      })
    : await prisma.socialAccount.findFirst({ where: { platformKey, isConnected: true } });

  const data = {
    externalUserId: input.externalUserId,
    externalUsername: input.externalUsername,
    externalUrl: input.externalUrl,
    accountType: input.accountType,
    scopes: input.scopes ? JSON.stringify(input.scopes) : undefined,
    tokenEncrypted: encryptToken(input.accessToken),
    refreshTokenEncrypted: input.refreshToken ? encryptToken(input.refreshToken) : undefined,
    tokenExpiresAt: input.tokenExpiresAt,
    tokenIssuedAt: new Date(),
    isConnected: true,
    status: input.verifiedOk === false ? "needs_refresh" : "connected",
    lastError: input.verifiedOk === false ? "Token saved but connection verification failed" : null,
    lastCheckedAt: new Date(),
    rawProfileJson: input.rawProfile ?? undefined,
  };

  const account = existing
    ? await prisma.socialAccount.update({ where: { id: existing.id }, data })
    : await prisma.socialAccount.create({
        data: { platformKey, ...data },
      });

  await logActivity(platformKey, null, "info", `${platform.name} account connected`, "connect");
  return { accountId: account.id };
}

/** Load a connected account's live credentials (decrypted, in-memory only). */
export async function getAccountCredentials(accountId: string) {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account || !account.isConnected) return null;
  const accessToken = decryptToken(account.tokenEncrypted);
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: decryptToken(account.refreshTokenEncrypted) ?? undefined,
    tokenExpiresAt: account.tokenExpiresAt,
    externalUserId: account.externalUserId,
    externalUsername: account.externalUsername,
    rawProfile: account.rawProfileJson,
  };
}

/** Resolve the best connected account for a platform (first connected). */
export async function resolveAccountForPlatform(platformKey: string) {
  return prisma.socialAccount.findFirst({
    where: { platformKey, isConnected: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Append a row to the audit log. Never logs token material. */
export async function logActivity(
  platformKey: string,
  queueItemId: string | null,
  level: "info" | "success" | "warn" | "error",
  message: string,
  status?: string,
  detail?: string,
): Promise<void> {
  await prisma.socialPostLog.create({
    data: { platformKey, queueItemId, level, message, status: status ?? null, detail: detail ?? null },
  });
}

/** Build a seed-able platform row from the registry. */
export function seedPlatformRow(key: string) {
  const meta = PLATFORM_META[key as PlatformKey];
  const hasCreds = meta.credentialEnvKeys.every((k) => Boolean(process.env[k]));
  return {
    key: meta.key,
    name: meta.name,
    color: meta.color,
    icon: meta.key,
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
    apiStatus: hasCreds ? "configured" : "not_configured",
    apiNote: null,
    displayOrder: PLATFORM_KEYS.indexOf(meta.key),
  };
}

import { PLATFORM_KEYS } from "./registry";