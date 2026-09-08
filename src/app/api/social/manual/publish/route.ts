import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { resolveMediaRefs } from "@/lib/social/media";
import { getAdapter } from "@/lib/social/adapter";
import { getAccountCredentials } from "@/lib/social/oauth";
import { makeRateLimiter } from "@/lib/secure";

export const dynamic = "force-dynamic";

const manualPublishLimiter = makeRateLimiter(20, 60_000);

// POST /api/social/manual/publish
//   body: { platformKey, title?, caption, linkUrl?, media?: StructuredMediaRef[], contentRefId?, contentType? }
// Publishes immediately through the official API and records the outcome.
export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!manualPublishLimiter("manual-publish")) {
    return NextResponse.json({ error: "Too many manual publishes. Try again shortly." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const platformKey = String(body?.platformKey ?? "");
  const caption = String(body?.caption ?? "");
  if (!platformKey) return NextResponse.json({ error: "platformKey required" }, { status: 400 });
  if (!caption.trim()) return NextResponse.json({ error: "caption required" }, { status: 400 });

  const account = await prisma.socialAccount.findFirst({ where: { platformKey, isConnected: true } });
  if (!account) {
    return NextResponse.json({ error: "No connected account for this platform. Connect one first." }, { status: 400 });
  }

  const creds = await getAccountCredentials(account.id);
  if (!creds) return NextResponse.json({ error: "Account token is unreadable. Re-connect the account." }, { status: 400 });

  const media = await resolveMediaRefs(Array.isArray(body?.media) ? body.media : []);
  const payload = {
    caption,
    title: body?.title ? String(body.title) : undefined,
    linkUrl: body?.linkUrl ? String(body.linkUrl) : undefined,
    media,
    contentType: body?.contentType ? String(body.contentType) : "promo",
    contentRefId: body?.contentRefId ? String(body.contentRefId) : undefined,
  };

  const adapter = getAdapter(platformKey as never);
  let result;
  try {
    result = await adapter.publish(creds, payload);
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  await prisma.socialPostLog.create({
    data: {
      platformKey,
      level: result.ok ? "success" : "error",
      message: result.ok ? "Manual post published" : `Manual publish failed: ${result.error ?? "unknown error"}`,
      status: result.ok ? "PUBLISHED" : "FAILED",
      detail: result.detail ?? null,
    },
  });

  const id = result.externalPostId ?? null;
  const post = await prisma.socialPost.create({
    data: {
      platformKey,
      accountId: account.id,
      title: payload.title ?? caption.split("\n")[0].slice(0, 80),
      caption,
      mediaJson: media.length ? JSON.stringify(media) : null,
      linkUrl: payload.linkUrl ?? null,
      contentType: payload.contentType ?? null,
      source: "MANUAL",
      externalPostId: id,
      externalUrl: result.externalUrl ?? null,
      status: result.ok ? "PUBLISHED" : "FAILED",
      error: result.ok ? null : result.error ?? null,
      publishedAt: result.ok ? new Date() : null,
    },
  });

  return NextResponse.json({ ok: result.ok, postId: post.id, ...(result as object) });
}