import { NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/emails/queue";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Admin "Process queue now" button — drains the backlog in small batches. */
export async function POST() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let sent = 0;
  let failed = 0;
  for (let round = 0; round < 5; round++) {
    const r = await processEmailQueue(50);
    sent += r.sent;
    failed += r.failed;
    if (r.claimed < 50) break;
  }
  return NextResponse.json({ ok: true, sent, failed });
}