import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { runTicketSourceSync } from "@/lib/ticketing/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/tickets/admin/sources/[id]/sync — run a ticket sync for one source.
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const result = await runTicketSourceSync(id);
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}