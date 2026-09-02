import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getTicketStats } from "@/lib/ticketing/service";

export const dynamic = "force-dynamic";

// GET /api/tickets/admin/stats — dashboard numbers.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stats = await getTicketStats();
  return NextResponse.json({ stats });
}