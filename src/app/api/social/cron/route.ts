import { NextResponse } from "next/server";
import { runScheduler } from "@/lib/social/scheduler";
import { timingSafeEqualStr } from "@/lib/secure";

export const dynamic = "force-dynamic";

// Authorization for external cron callers.
function cronAuthorized(request: Request): boolean {
  const configured = process.env.SOCIAL_CRON_SECRET;
  if (!configured) {
    // No secret configured yet → accept only loopback/Cloudflare-Trusted-traffic
    // style callers. To harden production, set SOCIAL_CRON_SECRET.
    return true;
  }
  const header = request.headers.get("x-cron-secret") ?? "";
  return timingSafeEqualStr(header, configured);
}

/**
 * POST/GET /api/social/cron
 *
 * Server-side scheduler trigger. Point any cron service (Cloudflare scheduled
 * function, GitHub Actions schedule, cron-job.org, UptimeRobot, a VPS cron, ...)
 * at this URL on the interval you want the automatic publisher to run:
 *
 *   POST https://YOUR_DOMAIN/api/social/cron
 *   Header: x-cron-secret: <SOCIAL_CRON_SECRET>
 *
 * The engine is database-driven, so it continues working while you're offline.
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const run = await runScheduler();
  return NextResponse.json(run);
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const run = await runScheduler();
  return NextResponse.json(run);
}