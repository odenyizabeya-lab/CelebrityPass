/**
 * Telegram adapter — official Bot API only (https://core.telegram.org/bots/api).
 *
 * Telegram is token-entry, not OAuth: the admin creates a bot with @BotFather
 * and adds it to the target channel. The bot token lives in TELEGRAM_BOT_TOKEN
 * (server env) and the channel handle / chat id is stored on the account.
 *
 *   sendMessage  POST https://api.telegram.org/bot<token>/sendMessage
 *   sendPhoto    POST .../sendPhoto   (multipart photo + caption)
 *   sendVideo    POST .../sendVideo   (multipart video + caption)
 */

import type { AccountCredentials, OAuthTokenResponse, PublishPayload, PublishResult, SocialAdapter } from "../types";
import { fetchMediaBytes } from "../media";

interface TelegramResponse {
  ok?: boolean;
  description?: string;
  result?: unknown;
}

interface TelegramUser {
  id?: number;
  username?: string;
}

interface TelegramMessage {
  message_id?: number;
}

async function telegramCall(token: string, method: string, body: FormData | URLSearchParams): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body,
  });
  const json: TelegramResponse | null = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.description ?? `Telegram API ${res.status}`);
  }
  return json.result;
}

function asUser(result: unknown): TelegramUser {
  return (result ?? {}) as TelegramUser;
}

function asMessage(result: unknown): TelegramMessage {
  return (result ?? {}) as TelegramMessage;
}

const telegram: SocialAdapter = {
  key: "telegram",
  name: "Telegram",
  capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 1024, maxImages: 10 },
  oauth: false,

  buildAuthUrl() {
    return null;
  },

  async exchangeCode(): Promise<OAuthTokenResponse> {
    throw new Error("Telegram uses token entry, not OAuth.");
  },

  async refreshToken(): Promise<OAuthTokenResponse> {
    throw new Error("Telegram bot tokens do not expire.");
  },

  async verifyConnection(creds: AccountCredentials) {
    try {
      const me = asUser(await telegramCall(creds.accessToken, "getMe", new URLSearchParams()));
      return {
        ok: true,
        externalUserId: String(me?.id ?? ""),
        externalUsername: creds.externalUsername ?? `@${me?.username ?? "bot"}`,
        externalUrl: me?.username ? `https://t.me/${me.username}` : undefined,
        accountType: "bot",
        profile: me,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  async publish(creds, payload: PublishPayload): Promise<PublishResult> {
    const target = creds.externalUserId || creds.externalUsername;
    if (!target) {
      return { ok: false, error: "No Telegram channel is connected to this bot token." };
    }

    const token = creds.accessToken;
    const caption = payload.caption || "";
    const media = payload.media ?? [];

    // Photos/videos go through the appropriate multipart endpoint.
    if (media.length > 0) {
      const video = media.find((m) => (m.mimeType ?? "").startsWith("video/"));
      if (video) {
        const buf = await fetchMediaBytes(video);
        if (!buf) return { ok: false, error: "Could not read the video for Telegram." };
        const form = new FormData();
        form.append("chat_id", target);
        if (caption) form.append("caption", caption);
        form.append("video", new Blob([buf.bytes], { type: buf.mimeType ?? "video/mp4" }), video.name ?? "video.mp4");
        try {
          const result = asMessage(await telegramCall(token, "sendVideo", form));
          return { ok: true, externalPostId: String(result?.message_id ?? ""), externalUrl: `https://t.me/${String(target).replace("@", "")}/${result?.message_id ?? ""}` };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }
      // First image, then remaining images as medias.
      const first = media[0];
      const buf = await fetchMediaBytes(first);
      if (!buf) return { ok: false, error: "Could not read the image for Telegram." };
      if (media.length === 1) {
        const form = new FormData();
        form.append("chat_id", target);
        if (caption) form.append("caption", caption);
        form.append("photo", new Blob([buf.bytes], { type: buf.mimeType ?? "image/jpeg" }), first.name ?? "photo.jpg");
        try {
          const result = asMessage(await telegramCall(token, "sendPhoto", form));
          return { ok: true, externalPostId: String(result?.message_id ?? ""), externalUrl: `https://t.me/${String(target).replace("@", "")}/${result?.message_id ?? ""}` };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }
      // Multiple images -> sendPhoto with mediaGroup.
      const group = new FormData();
      group.append("chat_id", target);
      for (const img of media) {
        const b = await fetchMediaBytes(img);
        if (b) group.append("media", new Blob([b.bytes], { type: b.mimeType ?? "image/jpeg" }), img.name ?? "photo.jpg");
      }
      const result = await telegramCall(token, "sendMediaGroup", group).catch(() => null);
      const groupMessages = Array.isArray(result) ? (result as TelegramMessage[]) : null;
      if (groupMessages && groupMessages.length > 0) return { ok: true, externalPostId: String(groupMessages[0]?.message_id ?? "") };
    }

    // Plain text post.
    const params = new URLSearchParams({ chat_id: target, text: caption });
    try {
      const result = asMessage(await telegramCall(token, "sendMessage", params));
      return { ok: true, externalPostId: String(result?.message_id ?? ""), externalUrl: `https://t.me/${String(target).replace("@", "")}/${result?.message_id ?? ""}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export default telegram;