import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { timingSafeEqualStr } from "@/lib/secure";
import { runAllTicketSyncs } from "@/lib/ticketing/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/tickets/sync — run ticket sync for ALL enabled ticket sources.
// Auth: admin session OR server-side SYNC_SECRET via `x-sync-secret` header
// (so a cron/scheduler can trigger it headlessly).
export async function POST(request: NextRequest) {
  const isAdmin = await isAdminAuthed();
  const headerSecret = request.headers.get("x-sync-secret");
  const expectedSecret = process.env.SYNC_SECRET || "";
  const hasSecret = Boolean(expectedSecret) && headerSecret !== null && timingSafeEqualStr(headerSecret, expectedSecret);
  if (!isAdmin && !hasSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const results = await runAllTicketSyncs();
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}