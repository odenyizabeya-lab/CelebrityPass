/**
 * TikTok adapter — official TikTok OAuth v2 Content Posting API only.
 *
 *   Auth      https://www.tiktok.com/v2/auth/authorize/
 *   Tokens    https://open.tiktokapis.com/v2/oauth/token/
 *   User info https://open.tiktokapis.com/v2/user/info/
 *   Publish   https://open.tiktokapis.com/v2/post/publish/video/init/
 *             PUT {upload_url}  (video bytes)
 *             https://open.tiktokapis.com/v2/post/publish/status/fetch/
 *
 * Important: posting (video.publish) requires the TikTok app to complete
 * Content Posting app review. Until that happens TikTok returns code 40213
 * (PUBLISH_API permission denied) / 10008 (user not authorized) — surfaced as
 * a clear error, never retried blindly or worked around.
 */

import type { AccountCredentials, OAuthTokenResponse, PublishPayload, PublishResult, SocialAdapter } from "../types";
import { fetchMediaBytes } from "../media";

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

interface TikTokError {
  code?: string;
  message?: string;
}

interface TikTokResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: TikTokError;
  data?: {
    user?: {
      open_id?: string;
      username?: string;
      display_name?: string;
    };
    upload_url?: string;
    publish_id?: string;
    status?: string;
    video_id?: string;
    fail_reason?: string;
    fail_reason_list?: { fail_reason?: string }[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

async function tiktokFetch(url: string, init: RequestInit): Promise<TikTokResponse> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`TikTok API ${res.status}: ${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text) as TikTokResponse;
  } catch {
    return { error: { code: "bad_response", message: "Non-JSON response from TikTok" } };
  }
}

const tiktok: SocialAdapter = {
  key: "tiktok",
  name: "TikTok",
  capabilities: { text: true, image: false, video: true, requiresAccount: true, maxCaption: 2200, maxImages: 0 },
  oauth: true,

  buildAuthUrl({ clientId, redirectUri, state, scopes }) {
    const params = new URLSearchParams({
      client_key: clientId,
      response_type: "code",
      scope: scopes.join(","),
      redirect_uri: redirectUri,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  },

  async exchangeCode({ clientId, clientSecret, redirectUri, code }): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_key: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const json = await tiktokFetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!json.access_token) throw new Error("TikTok did not return an access token.");
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresInSeconds: json.expires_in,
      scopes: json.scope ? json.scope.split(",") : undefined,
      raw: json,
    };
  },

  async refreshToken({ clientId, clientSecret, refreshToken }): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_key: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    const json = await tiktokFetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!json.access_token) throw new Error("TikTok did not return an access token.");
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresInSeconds: json.expires_in,
      scopes: json.scope ? json.scope.split(",") : undefined,
      raw: json,
    };
  },

  async verifyConnection(creds: AccountCredentials) {
    const fields = ["open_id", "union_id", "avatar_url", "avatar_url_100", "display_name", "username", "bio_description", "is_verified", "follower_count"];
    const json = await tiktokFetch(`${USER_INFO_URL}?fields=${fields.join(",")}`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    if (json?.error) {
      return { ok: false, error: `${json.error.code}: ${json.error.message}` };
    }
    const user = json?.data?.user ?? {};
    return {
      ok: true,
      externalUserId: user.open_id,
      externalUsername: user.username || user.display_name,
      externalUrl: user.username ? `https://www.tiktok.com/@${user.username}` : undefined,
      accountType: "influencer",
      profile: user,
    };
  },

  async publish(creds, payload: PublishPayload): Promise<PublishResult> {
    const video = payload.media.find((m) => (m.mimeType ?? "").startsWith("video/")) ?? payload.media[0];
    if (!video) {
      return { ok: false, error: "TikTok posts require a video file." };
    }
    const media = await fetchMediaBytes(video);
    if (!media || media.bytes.length === 0) {
      return { ok: false, error: "Could not read the video for upload." };
    }

    // 1) Initialize the direct-upload publish.
    const initBody = {
      post_info: {
        title: (payload.caption || "").slice(0, 2200),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: media.bytes.length,
        chunk_size: media.bytes.length,
        total_chunk_count: 1,
      },
    };

    let initJson: TikTokResponse;
    try {
      initJson = await tiktokFetch(INIT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.from(JSON.stringify(initBody)).byteLength),
        },
        body: JSON.stringify(initBody),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/40213|10008|not.?authorized|permission|review/i.test(msg)) {
        return {
          ok: false,
          error: "TikTok denied video publishing. Your TikTok Developer app has not been approved for Content Posting (video.publish) yet.",
          requiresApproval: true,
          detail: msg,
        };
      }
      return { ok: false, error: msg, detail: msg };
    }

    const data = initJson?.data;
    const err = initJson?.error;
    if (err) {
      const msg = `${err.code}: ${err.message}`;
      if (/40213|10008|not.?authorized|permission|review/i.test(msg)) {
        return { ok: false, error: "TikTok denied video publishing. Your TikTok app has not been approved for Content Posting yet.", requiresApproval: true, detail: msg };
      }
      return { ok: false, error: msg, detail: msg };
    }
    if (!data?.upload_url) {
      return { ok: false, error: "TikTok did not return an upload URL." };
    }

    // 2) Upload bytes to TikTok's storage.
    const uploadUrl = data.upload_url;
    const upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": media.mimeType ?? "video/mp4" },
      body: media.bytes,
    });
    if (!upload.ok) {
      return { ok: false, error: `TikTok video upload failed (HTTP ${upload.status}).`, detail: (await upload.text()).slice(0, 400) };
    }

    // 3) Poll the publish status.
    const publishId = data.publish_id;
    const statusPayload = { publish_id: publishId };
    const verified = await tiktokFetch(STATUS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(statusPayload),
    });

    const failReason = verified?.data?.fail_reason || verified?.data?.fail_reason_list?.[0]?.fail_reason;
    const state = verified?.data?.status;
    if (state && state !== "PUBLISH_COMPLETE") {
      return {
        ok: false,
        error: failReason || `TikTok publish failed (status: ${state}).`,
        detail: JSON.stringify(verified?.data ?? {}).slice(0, 500),
      };
    }

    const videoId = verified?.data?.video_id;
    return {
      ok: true,
      externalPostId: String(videoId ?? publishId),
      externalUrl: creds.externalUsername ? `https://www.tiktok.com/@${creds.externalUsername}/video/${videoId}` : undefined,
      detail: `Video id ${videoId ?? publishId}`,
    };
  },
};

export default tiktok;