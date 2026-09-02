// Headless event sync for scheduled jobs (Windows Task Scheduler, cron, etc.).
// Calls this app's own sync endpoint using the server-side SYNC_SECRET.
// Requirements: the app server must be running and SYNC_SECRET must be set
// in the server's environment (and here via the same env var).
//
// Usage:
//   $env:SYNC_SECRET="..." ; node scripts/sync-events.mjs
//   SYNC_SECRET=... node scripts/sync-events.mjs  (POSIX shells)
const baseUrl = process.env.APP_URL || "http://localhost:3000";
const secret = process.env.SYNC_SECRET || "";
const sourceId = process.env.SOURCE_ID || "";

async function main() {
  if (!secret) {
    console.error("SYNC_SECRET is not set. Configure it in the server environment (and here) before scheduling syncs.");
    process.exit(1);
  }
  const url = `${baseUrl}/api/events/sync`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-secret": secret,
    },
    body: JSON.stringify(sourceId ? { sourceId } : {}),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Sync request failed:", res.status, JSON.stringify(data));
    process.exit(1);
  }
  console.log("Sync completed:", new Date().toISOString());
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
