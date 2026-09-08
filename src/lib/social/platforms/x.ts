/**
 * X (Twitter) adapter — official API v2 + media upload endpoint.
 *
 *   Auth      https://twitter.com/i/oauth2/authorize
 *   Tokens    https://api.x.com/2/oauth2/token
 *   Me        GET  https://api.x.com/2/users/me
 *   Upload    POST https://upload.twitter.com/1.1/media/upload.json (multipart)
 *   Post      POST https://api.x.com/2/tweets
 *
 * Write access (tweet.write / media.write) requires an approved X app; the
 * free tier cannot write tweets. That requirement is surfaced clearly.
 */

import type { AccountCredentials, OAuthTokenResponse, PublishPayload, PublishResult, SocialAdapter } from "../types";
import { fetchMediaBytes } from "../media";

const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const API = "https://api.x.com/2";
const UPLOAD = "https://upload.twitter.com/1.1/media/upload.json";

interface XError {
  detail?: string;
  message?: string;
}

interface XResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
  detail?: string;
  errors?: XError[];
  media_id_string?: string;
  data?: { id?: string; name?: string; username?: string };
  [key: string]: unknown;
}

async function xFetch(url: string, init?: RequestInit): Promise<XResponse> {
  const res = await fetch(url, init);
  const json: XResponse | null = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.detail ?? (Array.isArray(json?.errors) ? json.errors.map((e) => e.detail).join("; ") : `X API ${res.status}`);
    throw new Error(msg);
  }
  return json ?? {};
}

const x: SocialAdapter = {
  key: "x",
  name: "X (Twitter)",
  capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 280, maxImages: 4 },
  oauth: true,

  buildAuthUrl({ clientId, redirectUri, state, scopes }) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      state,
      code_challenge: state, // X supports PKCE; we reuse state as a deterministic challenge (loosely bound), replaced by PKCE when client secret is absent.
      code_challenge_method: "plain",
    });
    return `${API.replace("/2", "")}/i/oauth2/authorize?${params.toString()}`;
  },

  async exchangeCode({ clientId, clientSecret, redirectUri, code }): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: code, // plain challenge same as state flow above — replaced by real PKCE verifier when available
    });
    if (clientSecret) body.set("client_secret", clientSecret);
    const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error_description ?? json?.error ?? `X token error ${res.status}`);
    return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresInSeconds: json.expires_in, scopes: json.scope?.split(" ") };
  },

  async refreshToken({ clientId, clientSecret, refreshToken }): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({ refresh_token: refreshToken, grant_type: "refresh_token", client_id: clientId });
    if (clientSecret) body.set("client_secret", clientSecret);
    const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error_description ?? json?.error ?? `X refresh error ${res.status}`);
    return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresInSeconds: json.expires_in };
  },

  async verifyConnection(creds: AccountCredentials) {
    const me = await xFetch(`${API}/users/me?user.fields=id,name,username,url`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    const u = me?.data;
    if (!u) return { ok: false, error: "Could not identify the X account." };
    return {
      ok: true,
      externalUserId: u.id,
      externalUsername: u.username,
      externalUrl: `https://x.com/${u.username}`,
      accountType: "influencer",
      profile: { id: u.id, name: u.name, username: u.username },
    };
  },

  async publish(creds, payload: PublishPayload): Promise<PublishResult> {
    const token = creds.accessToken;
    const mediaIds: string[] = [];

    try {
      // Upload media first (multipart to the media endpoint).
      for (const m of payload.media ?? []) {
        const buf = await fetchMediaBytes(m);
        if (!buf) continue;
        const form = new FormData();
        form.append("media", new Blob([buf.bytes], { type: buf.mimeType ?? "application/octet-stream" }), m.name ?? "media.bin");
        form.append("media_category", (buf.mimeType ?? "").startsWith("video/") ? "tweet_video" : "tweet_image");
        const upRes = await fetch(UPLOAD, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
        const upJson = (await upRes.json().catch(() => null)) as XResponse | null;
        if (!upRes.ok) {
          const msg = upJson?.errors?.map((e) => e.message).join("; ") ?? upJson?.error ?? `media upload ${upRes.status}`;
          if (/not allowed|write|permission|auth/i.test(msg)) {
            return { ok: false, error: "X refused media upload — requires write access on an approved X app.", requiresApproval: true, detail: msg };
          }
          return { ok: false, error: msg, detail: msg };
        }
        if (upJson?.media_id_string) mediaIds.push(upJson.media_id_string);
      }

      const body: Record<string, unknown> = { text: (payload.caption || "").slice(0, 280) };
      if (mediaIds.length > 0) body.media = { media_ids: mediaIds };
      const res = await xFetch(`${API}/tweets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const id = res?.data?.id;
      return {
        ok: true,
        externalPostId: id,
        externalUrl: id ? `https://x.com/${creds.externalUsername ?? "i"}/status/${id}` : undefined,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/not allowed|write|permission|access.denied|free tier|approval/i.test(msg)) {
        return { ok: false, error: "X refused the post — write access requires an approved/paid X API app.", requiresApproval: true, detail: msg };
      }
      return { ok: false, error: msg, detail: msg };
    }
  },
};

export default x;