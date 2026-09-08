/**
 * YouTube adapter — official YouTube Data API v3 (resumable upload).
 *
 *   Auth         Google OAuth 2.0 (youtube.upload + youtube.readonly)
 *   Tokens       https://oauth2.googleapis.com/token
 *   Channels     GET https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true
 *   Upload       POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable
 *                PUT {Location URL}  (video bytes)
 *
 * Uploading consumes YouTube Data API quota (default 10,000 units/day;
 * a single video upload costs ~1,600 units). Quota exhaustion is surfaced.
 */

import type { AccountCredentials, OAuthTokenResponse, PublishPayload, PublishResult, SocialAdapter } from "../types";
import { fetchMediaBytes } from "../media";

const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const youtube: SocialAdapter = {
  key: "youtube",
  name: "YouTube",
  capabilities: { text: true, image: false, video: true, requiresAccount: true, maxCaption: 5000 },
  oauth: true,

  buildAuthUrl({ clientId, redirectUri, state, scopes }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state,
      access_type: "offline",
      prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeCode({ clientId, clientSecret, redirectUri, code }): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    });
    const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error_description ?? json?.error ?? `Google token error ${res.status}`);
    return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresInSeconds: json.expires_in };
  },

  async refreshToken({ clientId, clientSecret, refreshToken }): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error_description ?? json?.error ?? `Google token error ${res.status}`);
    return { accessToken: json.access_token, expiresInSeconds: json.expires_in };
  },

  async verifyConnection(creds: AccountCredentials) {
    const res = await fetch(`${API}/channels?part=snippet&mine=true`, { headers: { Authorization: `Bearer ${creds.accessToken}` } });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error?.message ?? `YouTube API ${res.status}`);
    const ch = json?.items?.[0];
    if (!ch) return { ok: false, error: "No YouTube channel is associated with this account." };
    return {
      ok: true,
      externalUserId: ch.id,
      externalUsername: ch.snippet?.title ?? ch.id,
      externalUrl: `https://www.youtube.com/channel/${ch.id}`,
      accountType: "channel",
      profile: { id: ch.id, title: ch.snippet?.title },
    };
  },

  async publish(creds, payload: PublishPayload): Promise<PublishResult> {
    const video = payload.media.find((m) => (m.mimeType ?? "").startsWith("video/"));
    if (!video) return { ok: false, error: "YouTube posts require a video file." };
    const media = await fetchMediaBytes(video);
    if (!media || media.bytes.length === 0) return { ok: false, error: "Could not read the video for YouTube." };

    const metadata = {
      snippet: {
        title: (payload.caption || "New post").split("\n")[0].slice(0, 100),
        description: payload.caption || "",
        categoryId: "22", // People & Blogs
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    };

    try {
      const initRes = await fetch(`${UPLOAD}?uploadType=resumable&part=snippet,status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": media.mimeType ?? "video/mp4",
        },
        body: JSON.stringify(metadata),
      });
      if (!initRes.ok) {
        const text = await initRes.text();
        if (/quota/i.test(text)) return { ok: false, error: "YouTube upload rejected — Data API quota exhausted.", detail: text.slice(0, 400) };
        return { ok: false, error: `YouTube upload init failed (HTTP ${initRes.status})`, detail: text.slice(0, 400) };
      }
      const location = initRes.headers.get("location");
      if (!location) return { ok: false, error: "YouTube did not return an upload location." };

      const upRes = await fetch(location, {
        method: "PUT",
        headers: { "Content-Type": media.mimeType ?? "video/mp4" },
        body: media.bytes,
      });
      const videoJson = await upRes.json().catch(() => null);
      if (!upRes.ok) return { ok: false, error: `YouTube video upload failed (HTTP ${upRes.status})`, detail: JSON.stringify(videoJson).slice(0, 400) };
      const id = videoJson?.id;
      return {
        ok: true,
        externalPostId: id,
        externalUrl: id ? `https://www.youtube.com/watch?v=${id}` : undefined,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export default youtube;