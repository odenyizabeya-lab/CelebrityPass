import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parseLimit(url: URL, fallback = 100): number {
  const n = parseInt(url.searchParams.get("limit") ?? String(fallback), 10);
  return Math.min(isNaN(n) ? fallback : n, 300);
}

// GET /api/social/admin/posts — published posts.
export async function GET(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const limit = parseLimit(url);

  const rows = await prisma.socialPost.findMany({
    where: {
      ...(platform ? { platformKey: platform } : {}),
      ...(status ? { status: status as never } : { status: { in: ["PUBLISHED", "SKIPPED"] } }),
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: {
      platform: { select: { name: true, color: true } },
      account: { select: { externalUsername: true } },
    },
  });
  return NextResponse.json({
    posts: rows.map((p) => ({
      id: p.id,
      title: p.title,
      caption: p.caption,
      platformKey: p.platformKey,
      platformName: p.platform.name,
      platformColor: p.platform.color,
      accountUsername: p.account?.externalUsername ?? null,
      source: p.source,
      contentType: p.contentType,
      externalPostId: p.externalPostId,
      externalUrl: p.externalUrl,
      status: p.status,
      error: p.error,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
      mediaJson: p.mediaJson,
    })),
  });
}

// GET /api/social/admin/failed — failed posts (helper endpoint keeps the UI simple).
export async function getFailedPosts(limit = 100) {
  return prisma.socialPost.findMany({
    where: { status: "FAILED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { platform: { select: { name: true, color: true } } },
  });
}