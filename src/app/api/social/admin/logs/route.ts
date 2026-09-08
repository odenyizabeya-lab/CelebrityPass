import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/social/admin/logs — append-only post logs.
export async function GET(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") ?? undefined;
  const level = url.searchParams.get("level") ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "150", 10) || 150, 400);

  const rows = await prisma.socialPostLog.findMany({
    where: {
      ...(platform ? { platformKey: platform } : {}),
      ...(level ? { level: level as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { platform: { select: { name: true, color: true } } },
  });
  return NextResponse.json({
    logs: rows.map((l) => ({
      id: l.id,
      platformKey: l.platformKey,
      platformName: l.platform?.name ?? l.platformKey,
      platformColor: l.platform?.color ?? "#8b5cf6",
      level: l.level,
      message: l.message,
      detail: l.detail,
      status: l.status,
      createdAt: l.createdAt,
      queueItemId: l.queueItemId,
    })),
  });
}