import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { logActivity } from "@/lib/social/oauth";
import { ensureSocialSeed } from "@/lib/social/db";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["celebrity", "membership", "event", "article", "promo"];

// GET /api/social/admin/queue?status=&platform=&source=&limit=
export async function GET(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const platform = url.searchParams.get("platform") ?? undefined;
  const source = url.searchParams.get("source") ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 500);

  const items = await prisma.socialQueueItem.findMany({
    where: {
      ...(status ? { status: { in: status.split(",") } } : {}),
      ...(platform ? { platformKey: platform } : {}),
      ...(source ? { source: source as never } : {}),
      status: status ? undefined : { not: "PUBLISHED" },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { platform: { select: { name: true, color: true } }, account: { select: { externalUsername: true } } },
  });

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      contentKey: i.contentKey,
      platformKey: i.platformKey,
      platformName: i.platform.name,
      platformColor: i.platform.color,
      accountUsername: i.account?.externalUsername ?? null,
      contentType: i.contentType,
      contentRefId: i.contentRefId,
      title: i.title,
      caption: i.caption,
      linkUrl: i.linkUrl,
      source: i.source,
      status: i.status,
      scheduledFor: i.scheduledFor,
      attempts: i.attempts,
      maxAttempts: i.maxAttempts,
      nextAttemptAt: i.nextAttemptAt,
      lastError: i.lastError,
      externalUrl: i.externalUrl,
      publishedAt: i.publishedAt,
      createdAt: i.createdAt,
    })),
  });
}

// POST /api/social/admin/queue — create a PROMO / scheduled / draft queue item.
//   body: { platformKey, contentType, title, caption, mediaJson, linkUrl, source: "PROMO"|"MANUAL", status: "QUEUED"|"SCHEDULED"|"DRAFT", scheduledFor? }
export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const platformKey = String(body?.platformKey ?? "");
  const title = String(body?.title ?? "").trim();
  if (!platformKey) return NextResponse.json({ error: "platformKey is required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const contentType = ALLOWED_TYPES.includes(String(body?.contentType)) ? String(body.contentType) : "promo";
  const source = body?.source === "MANUAL" ? "MANUAL" : "PROMO";
  const status = ["DRAFT", "QUEUED", "SCHEDULED"].includes(String(body?.status)) ? String(body.status) : "QUEUED";
  const scheduledFor = body?.scheduledFor ? new Date(String(body.scheduledFor)) : status === "SCHEDULED" ? new Date(Date.now() + 60_000) : null;

  await ensureSocialSeed().catch(() => undefined);

  // Dedupe: same promo content can't be queued twice for the same platform.
  const contentKey = `promo:${source}:${Buffer.from(title).toString("base64url").slice(0, 40)}:${platformKey}`;
  const exists = await prisma.socialQueueItem.findUnique({
    where: { contentKey_platformKey: { contentKey, platformKey } },
  });
  if (exists) {
    return NextResponse.json({ error: "This content is already in the queue for this platform.", existingId: exists.id }, { status: 409 });
  }

  await prisma.socialQueueItem.create({
    data: {
      contentKey,
      platformKey,
      contentType,
      contentRefId: body?.contentRefId ? String(body.contentRefId) : null,
      title,
      caption: body?.caption ? String(body.caption) : null,
      mediaJson: body?.mediaJson ? JSON.stringify(body.mediaJson) : null,
      linkUrl: body?.linkUrl ? String(body.linkUrl) : null,
      source,
      status,
      scheduledFor,
      maxAttempts: 3,
    },
  });
  await logActivity(platformKey, null, "info", `Queued "${title}"`, status);
  return NextResponse.json({ ok: true });
}