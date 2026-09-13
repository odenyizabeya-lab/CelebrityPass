process.env.LIVE_E2E = "1";
const __proj = "C:/all cleb card/fancard-platform";
try { require("dotenv").config({ path: require("node:path").join(process.env.TEMP ?? "C:/Users/HP/AppData/Local/Temp", "opencode", "venv.prod") }); } catch {}
if (!process.env.COOKIE_SECRET) {
  const fs = require("node:fs");
  const f = fs.readFileSync(require("node:path").join(process.env.TEMP ?? "C:/Users/HP/AppData/Local/Temp", "opencode", "venv.prod"), "utf8");
  for (const line of f.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
const crypto = require("node:crypto");
const dns = require("node:dns");
try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch {}
const COOKIE_SECRET = process.env.COOKIE_SECRET;
if (!COOKIE_SECRET) { console.error("No COOKIE_SECRET"); process.exit(1); }
const signToken = (p) => `${p}.${crypto.createHmac("sha256", COOKIE_SECRET).update(p).digest("hex")}`;
const BASE = "https://celebritypass.app";
const FAN_ID = "cmttmj7w00000l804m7syq8bg";
const CONV_ID = "cmtyb0hyb0001jp04t6imwzjb";
const cookie = `fc_fan=${signToken(FAN_ID)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gett(url, opts) { let last; for (let i = 0; i < 6; i++) { try { return await fetch(url, opts); } catch (e) { last = e; await sleep(5000); } } throw last; }

(async () => {
  const phase = process.argv[2] || "visit";
  if (phase !== "read") {
    const msgs = { visit: "I would love to meet you one day please, it is my biggest dream to see you in person", love: "I love you more than anything, you have my whole heart" };
    const text = msgs[phase];
    console.log(`[${phase}] sending: ${text}`);
    const r = await gett(`${BASE}/api/chat/${CONV_ID}/messages`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ clientId: `e2e-${phase}-${Date.now()}`, type: "text", body: text }) });
    console.log(`POST ${r.status}`);
  }
  await sleep(45000);
  const res = await gett(`${BASE}/api/chat/${CONV_ID}/messages?limit=10`, { headers: { Cookie: cookie } });
  const conv = await res.json();
  console.log("--- newest first ---");
  for (const m of (conv.messages ?? []).slice(-8)) console.log(`[${m.senderType}] ${String(m.body).slice(0, 200)}`);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });