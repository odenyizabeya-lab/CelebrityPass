import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { logActivity } from "@/lib/social/oauth";
import { publishQueueItem } from "@/lib/social/publisher";

export const dynamic = "force-dynamic";

// POST /api/social/admin/queue/[id]
//   { action: "approve" } → send for publishing now
//   { action: "cancel" }  → cancel
//   { action: "retry" }   → reset attempts and re-queue
//   { action: "publish" } → publish immediately
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const item = await prisma.socialQueueItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  switch (action) {
    case "approve":
      await prisma.socialQueueItem.update({
        where: { id },
        data: { status: "QUEUED", scheduledFor: new Date(), lastError: null },
      });
      await logActivity(item.platformKey, id, "info", `Approved "${item.title}" for publishing`, "QUEUED");
      return NextResponse.json({ ok: true });

    case "cancel":
      await prisma.socialQueueItem.update({ where: { id }, data: { status: "CANCELLED" } });
      await logActivity(item.platformKey, id, "warn", `Cancelled "${item.title}"`, "CANCELLED");
      return NextResponse.json({ ok: true });

    case "retry":
      await prisma.socialQueueItem.update({
        where: { id },
        data: { status: "QUEUED", attempts: 0, nextAttemptAt: new Date(), lastError: null },
      });
      await logActivity(item.platformKey, id, "info", `Retrying "${item.title}"`, "QUEUED");
      return NextResponse.json({ ok: true });

    case "publish": {
      await prisma.socialQueueItem.updateMany({
        where: { id, status: { in: ["QUEUED", "SCHEDULED", "APPROVAL_REQUIRED", "FAILED"] } },
        data: { status: "PROCESSING", attempts: item.attempts, nextAttemptAt: null },
      });
      const outcome = await publishQueueItem(id);
      return NextResponse.json({ ok: outcome.state === "PUBLISHED", ...outcome });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

// DELETE /api/social/admin/queue/[id] — permanently remove a queue item.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const item = await prisma.socialQueueItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.socialQueueItem.delete({ where: { id } });
  await logActivity(item.platformKey, null, "warn", `Deleted queue item "${item.title}"`, "DELETED");
  return NextResponse.json({ ok: true });
}