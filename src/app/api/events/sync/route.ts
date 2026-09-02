import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { timingSafeEqualStr } from "@/lib/secure";
import { runSourceSync } from "@/lib/events/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/events/sync
// Body: { sourceId } to sync one source, or empty for all enabled non-admin sources.
//
// Auth: an admin browser session OR a server-side SYNC_SECRET in the
// `x-sync-secret` header (so a cron/scheduler can trigger it headlessly).
export async function POST(request: NextRequest) {
  const isAdmin = await isAdminAuthed();
  const headerSecret = request.headers.get("x-sync-secret");
  const expectedSecret = process.env.SYNC_SECRET || "";
  const hasSecret = Boolean(expectedSecret) && headerSecret !== null && timingSafeEqualStr(headerSecret, expectedSecret);
  if (!isAdmin && !hasSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sourceId = body.sourceId ? String(body.sourceId) : undefined;

  try {
    if (sourceId) {
      const result = await runSourceSync(sourceId);
      return NextResponse.json({ result });
    }
    const sources = await prisma.eventSource.findMany({ where: { enabled: true, key: { not: "admin" } }, select: { id: true } });
    const results = [];
    for (const s of sources) results.push(await runSourceSync(s.id));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}
