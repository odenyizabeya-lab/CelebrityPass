// Headless ticket sync for scheduled jobs. Calls the app's own sync endpoint
// using the server-side SYNC_SECRET. Requirements: the server must be running
// and SYNC_SECRET must be in its environment (and here).
//
//   $env:SYNC_SECRET="..." ; node scripts/sync-tickets.mjs
const baseUrl = process.env.APP_URL || "http://localhost:3000";
const secret = process.env.SYNC_SECRET || "";

async function main() {
  if (!secret) {
    console.error("SYNC_SECRET is not set. Configure it in the server environment before scheduling ticket syncs.");
    process.exit(1);
  }
  const res = await fetch(`${baseUrl}/api/tickets/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sync-secret": secret },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Ticket sync failed:", res.status, JSON.stringify(data));
    process.exit(1);
  }
  console.log("Ticket sync completed:", new Date().toISOString());
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});