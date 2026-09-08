/**
 * Static registry of the supported social platforms.
 *
 * The DB table `SocialPlatform` is seeded from this registry once, and the
 * dashboard then layers live status on top (credentials configured, approval
 * status, connected accounts). All real credentials are read at runtime from
 * the env var names listed in `credentialEnvKeys` — never shipped to the UI.
 */

import type { PlatformKey, PlatformMeta } from "./types";

export const PLATFORM_KEYS: PlatformKey[] = [
  "tiktok",
  "telegram",
  "whatsapp",
  "facebook",
  "instagram",
  "youtube",
  "x",
  "pinterest",
  "linkedin",
];

export const PLATFORM_META: Record<PlatformKey, PlatformMeta> = {
  tiktok: {
    key: "tiktok",
    name: "TikTok",
    color: "#69C9D0",
    oauth: true,
    capabilities: { text: true, image: false, video: true, requiresAccount: true, maxCaption: 2200, maxImages: 0, maxVideoMb: 500 },
    requiresApproval: true,
    approvalNote:
      "Posting videos (video.publish) requires TikTok app approval after submitting your TikTok Developer app for review. Until approved, connect still works but publishing fails with an approval error.",
    credentialEnvKeys: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "user.info.profile", "video.publish", "video.upload"],
    howToConnect:
      "Create a real TikTok Developer app at https://developers.tiktok.com/. Set the Redirect URI to your app's callback, add video.publish + video.upload scopes, request Content Posting app review, then set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in server env vars.",
  },
  telegram: {
    key: "telegram",
    name: "Telegram",
    color: "#2AABEE",
    oauth: false,
    capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 4096, maxImages: 10, maxVideoMb: 50 },
    requiresApproval: false,
    approvalNote: "Posting to a Telegram channel uses an official Bot token created with @BotFather — no app review.",
    credentialEnvKeys: ["TELEGRAM_BOT_TOKEN"],
    authUrl: "",
    tokenUrl: "https://api.telegram.org",
    scopes: [],
    howToConnect:
      "Create a bot with @BotFather on Telegram, add the bot as admin to your channel, then set TELEGRAM_BOT_TOKEN in server env vars. Connect the channel by entering its @username or channel id here.",
  },
  whatsapp: {
    key: "whatsapp",
    name: "WhatsApp Channels",
    color: "#25D366",
    oauth: false,
    capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 0, maxImages: 1, maxVideoMb: 16 },
    requiresApproval: true,
    approvalNote:
      "WhatsApp Channels posting uses the WhatsApp Business Cloud API with a System User token. Requires a verified WhatsApp Business Account and WhatsApp Channels access.",
    credentialEnvKeys: ["WHATSAPP_TOKEN", "WHATSAPP_CHANNEL_ID", "WHATSAPP_PHONE_ID"],
    authUrl: "",
    tokenUrl: "https://graph.facebook.com",
    scopes: [],
    howToConnect:
      "Set up a WhatsApp Business Account, create a System User token at the Meta Business Suite, enable WhatsApp Channels, then set WHATSAPP_TOKEN, WHATSAPP_CHANNEL_ID and WHATSAPP_PHONE_ID in server env vars.",
  },
  facebook: {
    key: "facebook",
    name: "Facebook Pages",
    color: "#1877F2",
    oauth: true,
    capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 0, maxImages: 10, maxVideoMb: 4000 },
    requiresApproval: false,
    approvalNote: "Publishing to your own Facebook Page works once the page is connected; no app review for standard pages publishing.",
    credentialEnvKeys: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
    howToConnect:
      "Create a Facebook app at developers.facebook.com, set the Redirect URI, then connect a Page you admin. FACEBOOK_APP_ID and FACEBOOK_APP_SECRET go in server env vars.",
  },
  instagram: {
    key: "instagram",
    name: "Instagram",
    color: "#E1306C",
    oauth: true,
    capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 2200, maxImages: 1, maxVideoMb: 100 },
    requiresApproval: true,
    approvalNote:
      "Instagram Content Publishing requires a Professional (Business/Creator) account linked to a Facebook Page, plus the Instagram API permissions granted to your Facebook app.",
    credentialEnvKeys: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["instagram_basic", "instagram_content_publish", "instagram_manage_comments", "pages_show_list", "pages_manage_posts"],
    howToConnect:
      "Switch your Instagram to a Professional account, link it to a Facebook Page, add instagram_content_publish to your Facebook app, then connect through this dashboard.",
  },
  youtube: {
    key: "youtube",
    name: "YouTube",
    color: "#FF0000",
    oauth: true,
    capabilities: { text: true, image: false, video: true, requiresAccount: true, maxCaption: 5000, maxImages: 0, maxVideoMb: 256000 },
    requiresApproval: false,
    approvalNote: "Uploading needs the Google Cloud project OAuth consent configured and youtube.upload scope verified.",
    credentialEnvKeys: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
    howToConnect:
      "Create a Google Cloud project, enable the YouTube Data API v3, build OAuth credentials, then set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in server env vars.",
  },
  x: {
    key: "x",
    name: "X (Twitter)",
    color: "#0f1419",
    oauth: true,
    capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 280, maxImages: 4, maxVideoMb: 512 },
    requiresApproval: true,
    approvalNote:
      "X requires the app to be approved for write access (tweet.write, media.write). Free-tier API keys must be converted to a paid plan for write access.",
    credentialEnvKeys: ["X_API_KEY", "X_API_KEY_SECRET"],
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"],
    howToConnect:
      "Create an app at developer.x.com, request write access, set the callback URL, then set X_API_KEY and X_API_KEY_SECRET in server env vars.",
  },
  pinterest: {
    key: "pinterest",
    name: "Pinterest",
    color: "#E60023",
    oauth: true,
    capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 500, maxImages: 1, maxVideoMb: 512 },
    requiresApproval: true,
    approvalNote: "Pinterest pins.pins:write needs your app in the approved API partners program for live posting.",
    credentialEnvKeys: ["PINTEREST_CLIENT_ID", "PINTEREST_CLIENT_SECRET"],
    authUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    scopes: ["boards:read", "pins:read", "pins:write", "user_accounts:read"],
    howToConnect:
      "Create an app at developers.pinterest.com, set the Redirect URI, then set PINTEREST_CLIENT_ID and PINTEREST_CLIENT_SECRET in server env vars.",
  },
  linkedin: {
    key: "linkedin",
    name: "LinkedIn",
    color: "#0A66C2",
    oauth: true,
    capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 3000, maxImages: 9, maxVideoMb: 200 },
    requiresApproval: true,
    approvalNote:
      "LinkedIn v2 APIs require a LinkedIn app with the Share on LinkedIn / Community Management products approved for your app.",
    credentialEnvKeys: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social"],
    howToConnect:
      "Create an app at developer.linkedin.com, request the w_member_social product, set the OAuth redirect, then set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in server env vars.",
  },
};

/** Resolve all env values for a platform (values only, server-side). */
export function platformEnv(meta: PlatformMeta): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of meta.credentialEnvKeys) {
    out[k] = process.env[k] ?? "";
  }
  return out;
}

/** True if every credential env var for a platform is set (non-empty). */
export function platformCredentialsConfigured(meta: PlatformMeta): boolean {
  return meta.credentialEnvKeys.every((k) => {
    const v = process.env[k];
    return typeof v === "string" && v.length > 0;
  });
}