import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { runScheduler } from "@/lib/social/scheduler";

export const dynamic = "force-dynamic";

// GET /api/social/admin/run — run the scheduler now from the dashboard.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const report = await runScheduler();
  return NextResponse.json(report);
}

export async function POST() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const report = await runScheduler();
  return NextResponse.json(report);
}