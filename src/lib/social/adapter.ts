/**
 * Adapter dispatcher. Each platform implements `SocialAdapter` in
 * `./platforms/*`. Only official public APIs are used — no bots, no scraping.
 *
 * If a platform needs app review / business verification / paid access, the
 * adapter surfaces a clear `requiresApproval` error instead of pretending.
 */

import type { PlatformKey, SocialAdapter } from "./types";
import tiktok from "./platforms/tiktok";
import telegram from "./platforms/telegram";
import whatsapp from "./platforms/whatsapp";
import facebook from "./platforms/facebook";
import instagram from "./platforms/instagram";
import youtube from "./platforms/youtube";
import x from "./platforms/x";
import pinterest from "./platforms/pinterest";
import linkedin from "./platforms/linkedin";

const ADAPTERS: Record<PlatformKey, SocialAdapter> = {
  tiktok,
  telegram,
  whatsapp,
  facebook,
  instagram,
  youtube,
  x,
  pinterest,
  linkedin,
};

export function getAdapter(key: PlatformKey): SocialAdapter {
  const adapter = ADAPTERS[key];
  if (!adapter) throw new Error(`Unknown platform: ${key}`);
  return adapter;
}