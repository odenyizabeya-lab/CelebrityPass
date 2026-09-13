import "dotenv/config";
import { join } from "node:path";
import { config } from "dotenv";
config({ path: join(process.env.TEMP ?? "C:/Users/HP/AppData/Local/Temp", "opencode", "venv.prod"), override: true });
import { maybeAutoReply } from "./src/lib/chat/autoReply";

const convId = "cmtyb0hyb0001jp04t6imwzjb";
(async () => {
  const t0 = Date.now();
  await maybeAutoReply(convId).catch((e) => console.error("maybeAutoReply threw:", e.message));
  console.log("done in", ((Date.now() - t0) / 1000).toFixed(1) + "s");
})();