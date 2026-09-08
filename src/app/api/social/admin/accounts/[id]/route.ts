import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { refreshAccountToken } from "@/lib/social/publisher";
import { logActivity } from "@/lib/social/oauth";

export const dynamic = "force-dynamic";

// GET /api/social/admin/accounts/[id] — one account (safe shape).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const account = await prisma.socialAccount.findUnique({ where: { id }, include: { platform: true } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: account.id,
    platformKey: account.platformKey,
    platformName: account.platform.name,
    username: account.externalUsername,
    url: account.externalUrl,
    accountType: account.accountType,
    status: account.status,
    isConnected: account.isConnected,
    lastError: account.lastError,
    lastCheckedAt: account.lastCheckedAt,
    tokenExpiresAt: account.tokenExpiresAt,
    hasRefreshToken: Boolean(account.refreshTokenEncrypted),
    scopes: account.scopes ? JSON.parse(account.scopes) : [],
  });
}

// POST /api/social/admin/accounts/[id]
//   { action: "refresh" }  → refresh token now
//   { action: "update", username?, accountType? } → edit display fields
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action === "refresh") {
    const ok = await refreshAccountToken(id);
    return NextResponse.json({ ok });
  }

  if (action === "update") {
    const data: Record<string, unknown> = {};
    if (typeof body?.username === "string") data.externalUsername = body.username || null;
    if (typeof body?.accountType === "string") data.accountType = body.accountType || null;
    await prisma.socialAccount.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// PATCH — soft tweak used by token-entry platforms.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.username === "string") data.externalUsername = body.username || null;
  if (typeof body?.channel === "string") data.externalUserId = body.channel || null;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  await prisma.socialAccount.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE — disconnect an account (tokens are destroyed, not exposed).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const account = await prisma.socialAccount.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.socialAccount.delete({ where: { id } });
  await logActivity(account.platformKey, null, "warn", `${account.platformKey} account disconnected`, "disconnected");
  return NextResponse.json({ ok: true });
}