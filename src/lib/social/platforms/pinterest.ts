/**
 * Pinterest adapter — official Pinterest API v5.
 *
 *   Auth      https://www.pinterest.com/oauth/
 *   Tokens    https://api.pinterest.com/v5/oauth/token
 *   Me        GET https://api.pinterest.com/v5/user_account
 *   Pins      POST https://api.pinterest.com/v5/pins
 *
 * Creating pins with your own media uses `image_base64` media_source, or
 * `image_url` for a public URL. Live pin publishing requires an approved
 * Pinterest developer app.
 */

import type { AccountCredentials, OAuthTokenResponse, PublishPayload, PublishResult, SocialAdapter } from "../types";

const BASE = "https://api.pinterest.com/v5";
const TOKEN_URL = `${BASE}/oauth/token`;

interface PinterestResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  message?: string;
  code?: string;
  error_description?: string;
  username?: string;
  id?: string;
  link?: string;
  [key: string]: unknown;
}

async function pinterestFetch(url: string, init?: RequestInit): Promise<PinterestResponse> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.message ?? (Array.isArray(json?.code) ? "Pinterest API error" : json?.error_description) ?? `Pinterest API ${res.status}`;
    throw new Error(String(msg));
  }
  return json ?? {};
}

const pinterest: SocialAdapter = {
  key: "pinterest",
  name: "Pinterest",
  capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 500, maxImages: 1 },
  oauth: true,

  buildAuthUrl({ clientId, redirectUri, state, scopes }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(","),
      state,
    });
    return `https://www.pinterest.com/oauth/?${params.toString()}`;
  },

  async exchangeCode({ clientId, clientSecret, redirectUri, code }): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: body.toString() });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.message ?? `Pinterest token error ${res.status}`);
    return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresInSeconds: json.expires_in, scopes: json.scope?.split(",") };
  },

  async refreshToken({ clientId, clientSecret, refreshToken }): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });
    const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: body.toString() });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.message ?? `Pinterest refresh error ${res.status}`);
    return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresInSeconds: json.expires_in };
  },

  async verifyConnection(creds: AccountCredentials) {
    const me = await pinterestFetch(`${BASE}/user_account`, { headers: { Authorization: `Bearer ${creds.accessToken}` } });
    return {
      ok: true,
      externalUserId: me?.username ?? undefined,
      externalUsername: me?.username ?? undefined,
      externalUrl: me?.username ? `https://www.pinterest.com/${me.username}/` : undefined,
      accountType: "influencer",
      profile: me,
    };
  },

  async publish(creds, payload: PublishPayload): Promise<PublishResult> {
    const media = payload.media ?? [];
    const image = media.find((m) => (m.mimeType ?? "").startsWith("image/")) ?? media[0];
    if (!image) return { ok: false, error: "Pinterest pins require an image." };

    let mediaSource: Record<string, unknown>;
    if (image.url?.startsWith("http")) {
      mediaSource = { source_type: "image_url", url: image.url };
    } else if (image.url?.startsWith("data:image")) {
      const mime = image.mimeType ?? "image/jpeg";
      const b64 = image.url.split(",")[1] ?? "";
      mediaSource = { source_type: "image_base64", content_type: mime, data: b64 };
    } else {
      return { ok: false, error: "Pinterest requires a public image URL or a base64 image." };
    }

    const body: Record<string, unknown> = {
      title: payload.title ?? (payload.caption || "").split("\n")[0]?.slice(0, 100),
      description: payload.caption || undefined,
      media_source: mediaSource,
    };
    if (payload.linkUrl) body.link = payload.linkUrl;

    try {
      const pin = await pinterestFetch(`${BASE}/pins`, {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { ok: true, externalPostId: pin?.id ?? undefined, externalUrl: pin?.link ?? undefined };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/approval|not approved|partner program|permission|sandbox/i.test(msg)) {
        return { ok: false, error: "Pinterest refused the pin — live publishing requires an approved app (API partner program).", requiresApproval: true, detail: msg };
      }
      return { ok: false, error: msg, detail: msg };
    }
  },
};

export default pinterest;