// Production e2e: send real fan messages through the live API with the real
// production cookie secret, then report the AI auto-replies + memory state.
process.env.LIVE_E2E = "1";
require("dotenv").config({ path: require("node:path").join(process.env.TEMP ?? "C:/Users/HP/AppData/Local/Temp", "opencode", "venv.prod") });
const crypto = require("node:crypto");
const dns = require("node:dns");

// The OS DNS has been flaky; route lookups via Google public DNS as a fallback.
try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch {}

const COOKIE_SECRET = process.env.COOKIE_SECRET;
if (!COOKIE_SECRET) { console.error("No COOKIE_SECRET from venv.prod"); process.exit(1); }
function signToken(payload) {
  return `${payload}.${crypto.createHmac("sha256", COOKIE_SECRET).update(payload).digest("hex")}`;
}

const BASE = "https://celebritypass.app";
const FAN_ID = "cmttmj7w00000l804m7syq8bg";
const CONV_ID = "cmtyb0hyb0001jp04t6imwzjb";
const cookie = `fc_fan=${signToken(FAN_ID)}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, opts) {
  let lastErr;
  for (let i = 0; i < 5; i++) {
    try { return await fetch(url, opts); } catch (e) { lastErr = e; await sleep(5000); }
  }
  throw lastErr;
}

async function main() {
  const phase = process.argv[2] || "read";
  const msgs = {
    money: "I really want the CelebrityPass card but I don't have money right now, times are hard",
    love: "Will you marry me one day? I swear I have never loved anyone the way I love you",
    visit: "I would love to meet you one day please, it is my biggest dream to see you in person",
  };

  if (phase !== "read") {
    const stamp = `e2e-${phase}-${Date.now()}`;
    const text = msgs[phase];
    console.log(`[${phase}] sending: ${text}`);
    const r = await get(`${BASE}/api/chat/${CONV_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ clientId: `${stamp}-m1`, type: "text", body: text }),
    });
    const rj = await r.json().catch(() => ({}));
    console.log(`POST ${r.status} message=${rj.message?.id}`);
  }

  // Let the always-on AI reply (it typically lands within a few seconds).
  await sleep(20000);
  const conv = await get(`${BASE}/api/chat/${CONV_ID}/messages?limit=8`, {
    headers: { Cookie: cookie },
  }).then((res) => res.json());
  const recent = (conv.messages ?? []).reverse();
  console.log("--- last messages after fan send ---");
  for (const m of recent.slice(-6)) {
    console.log(`[${m.senderType}:${m.type}] ${String(m.body).slice(0, 300)}`);
  }
}

main().catch((e) => { console.error("E2E failed:", e.message); process.exit(1); });