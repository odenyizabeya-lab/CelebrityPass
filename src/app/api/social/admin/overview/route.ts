import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getOverviewStats } from "@/lib/social/service";

export const dynamic = "force-dynamic";

// GET /api/social/admin/overview — dashboard stats.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stats = await getOverviewStats();
  return NextResponse.json(stats);
}