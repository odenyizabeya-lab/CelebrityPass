import { NextResponse, type NextRequest } from "next/server";
import { processEmailQueue } from "@/lib/emails/queue";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET ?? process.env.EMAIL_CRON_SECRET ?? "";

/**
 * Background queue worker entrypoint.
 *
 * Called by Vercel Cron (every 5 minutes), by the admin "Process now" button
 * (via /api/admin/emails/process), and internally right after new messages are
 * enqueued. Processes due emails in small batches, retrying failures up to 3
 * times with backoff.
 */
export async function GET(request: NextRequest) {
  if (!CRON_SECRET || request.headers.get("x-cron-secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await drainQueue();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("x-cron-secret") === CRON_SECRET) {
    const result = await drainQueue();
    return NextResponse.json({ ok: true, ...result });
  }
  if (await isAdminAuthed()) {
    const result = await drainQueue();
    return NextResponse.json({ ok: true, ...result });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Drain the backlog (up to 5 rounds) so a single invocation clears the queue. */
async function drainQueue() {
  let sent = 0;
  let failed = 0;
  let claimed = 0;
  for (let round = 0; round < 5; round++) {
    const r = await processEmailQueue(50);
    claimed += r.claimed;
    sent += r.sent;
    failed += r.failed;
    if (r.claimed < 50) break;
  }
  return { rounds: claimed ? 5 : 0, claimed, sent, failed };
}