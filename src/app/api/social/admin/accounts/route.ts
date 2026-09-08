import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { getPublicPlatforms } from "@/lib/social/service";
import { saveAccountTokens, buildAuthorizeUrl, createOAuthState } from "@/lib/social/oauth";
import { PLATFORM_META } from "@/lib/social/registry";

export const dynamic = "force-dynamic";

// GET /api/social/admin/accounts — platforms + connected accounts (safe masks only).
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const platforms = await getPublicPlatforms();
  return NextResponse.json({ platforms });
}

// POST /api/social/admin/accounts
//   { action: "connect-oauth", platformKey }     → starts OAuth (returns authorizeUrl)
//   { action: "connect-token", platformKey, token, channel? } → stores a token-entry platform (Telegram/WhatsApp)
//   { action: "refresh", accountId }             → force a token refresh
export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action === "connect-oauth") {
    const platformKey = String(body?.platformKey ?? "");
    const meta = PLATFORM_META[platformKey as never];
    if (!meta || !meta.oauth) return NextResponse.json({ error: "Platform does not use OAuth." }, { status: 400 });
    if (!meta.credentialEnvKeys.every((k) => process.env[k])) {
      return NextResponse.json({ error: `Missing credentials. Set ${meta.credentialEnvKeys.join(", ")} in server env vars first.` }, { status: 400 });
    }
    const state = await createOAuthState(platformKey);
    const url = buildAuthorizeUrl(platformKey, state);
    return NextResponse.json({ authorizeUrl: url, state });
  }

  if (action === "connect-token") {
    const platformKey = String(body?.platformKey ?? "");
    const token = String(body?.token ?? "").trim();
    const channel = String(body?.channel ?? "").trim() || null;
    if (platformKey !== "telegram" && platformKey !== "whatsapp") {
      return NextResponse.json({ error: "Token entry is only supported for Telegram and WhatsApp." }, { status: 400 });
    }
    if (!token) return NextResponse.json({ error: "Token is required." }, { status: 400 });

    // Telegram: validate the bot token with the official API before storing.
    const adapter = (await import("@/lib/social/adapter")).getAdapter(platformKey as never);
    const check = await adapter
      .verifyConnection({ accessToken: token, externalUsername: channel || undefined })
      .catch(() => ({ ok: false, error: "The token was rejected by the platform." }));
    if (check.ok === false) {
      return NextResponse.json({ error: check.error ?? "The token was rejected by the platform." }, { status: 400 });
    }

    await prisma.socialPlatform.upsert({
      where: { key: platformKey },
      update: { hasCredentials: true, apiStatus: "configured" },
      create: { key: platformKey, name: PLATFORM_META[platformKey].name, displayOrder: 0 },
    });

    const externalId = platformKey === "telegram" ? channel || (check.externalUsername ?? "@") : null;
    const result = await saveAccountTokens(platformKey, {
      accessToken: token,
      externalUserId: externalId,
      externalUsername: externalId ?? check.externalUsername,
      externalUrl: check.externalUrl,
      accountType: platformKey === "telegram" ? "bot" : "business",
      verifiedOk: true,
      rawProfile: check.profile ? JSON.stringify(check.profile) : undefined,
    });
    return NextResponse.json({ ok: true, accountId: result.accountId });
  }

  if (action === "refresh") {
    const accountId = String(body?.accountId ?? "");
    const { refreshAccountToken } = await import("@/lib/social/publisher");
    const ok = await refreshAccountToken(accountId);
    if (!ok) return NextResponse.json({ ok: false, error: "Refresh failed (no refresh token or provider rejected it)." });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}