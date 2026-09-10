/**
 * Facebook Pages adapter — official Graph API only.
 *
 *   Auth      https://www.facebook.com/v21.0/dialog/oauth
 *   Tokens    https://graph.facebook.com/v21.0/oauth/access_token
 *   Pages     GET  /me/accounts                       (page list + page tokens)
 *   Feed post POST /{page-id}/feed                    (text + link)
 *   Photo post POST /{page-id}/photos                 (image)
 *   Video post POST /{page-id}/videos                 (video)
 *
 * On connect we trade the user token for a long-lived page token and store it
 * as the account's access token.
 */

import type { AccountCredentials, OAuthTokenResponse, PublishPayload, PublishResult, SocialAdapter } from "../types";

const GRAPH = "https://graph.facebook.com/v21.0";

interface GraphError {
  message?: string;
}

interface GraphPage {
  id: string;
  name?: string;
  link?: string;
  access_token?: string;
  is_published?: boolean;
}

interface GraphResponse {
  id?: string;
  post_id?: string;
  access_token?: string;
  expires_in?: number;
  error?: GraphError;
  data?: GraphPage[];
  instagram_business_account?: GraphPage;
  [key: string]: unknown;
}

async function graphFetch(url: string, init?: RequestInit): Promise<GraphResponse> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Graph API ${res.status}`);
  }
  return json;
}

export function facebookGraphBase(): string {
  return GRAPH;
}

const facebook: SocialAdapter = {
  key: "facebook",
  name: "Facebook Pages",
  capabilities: { text: true, image: true, video: true, requiresAccount: true, maxImages: 10 },
  oauth: true,

  buildAuthUrl({ clientId, redirectUri, state, scopes }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: scopes.join(","),
      config_id: "",
    });
    params.delete("config_id");
    return `${GRAPH.replace("/v21.0", "")}/v21.0/dialog/oauth?${params.toString()}`;
  },

  async exchangeCode({ clientId, clientSecret, redirectUri, code }): Promise<OAuthTokenResponse> {
    const url = `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
    const json = await graphFetch(url);
    if (!json.access_token) throw new Error("Facebook did not return an access token.");
    return { accessToken: json.access_token, expiresInSeconds: json.expires_in, raw: json };
  },

  async refreshToken({ clientId, clientSecret, refreshToken }): Promise<OAuthTokenResponse> {
    // Long-lived token exchange for page tokens (page tokens don't expire when
    // the owner keeps the app active).
    const url = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&fb_exchange_token=${encodeURIComponent(refreshToken)}`;
    const json = await graphFetch(url);
    const accessToken = json.access_token;
    if (!accessToken) throw new Error("Facebook did not return an access token.");
    return { accessToken, expiresInSeconds: json.expires_in, raw: json };
  },

  async verifyConnection(creds: AccountCredentials) {
    let accounts: GraphResponse;
    try {
      accounts = await graphFetch(`${GRAPH}/me/accounts?fields=id,name,link,access_token,is_published`, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    const pages = accounts?.data ?? [];
    // Prefer a stored page id (externalUserId) else the first published page.
    const page = pages.find((p) => p.id === creds.externalUserId) ?? pages.find((p) => p.is_published) ?? pages[0];
    if (!page) return { ok: false, error: "No Facebook Pages are accessible with this token." };
    return {
      ok: true,
      externalUserId: page.id,
      externalUsername: page.name,
      externalUrl: page.link ?? `https://www.facebook.com/${page.id}`,
      accountType: "page",
      profile: { id: page.id, name: page.name, pages: pages.map((p) => ({ id: p.id, name: p.name })) },
    };
  },

  async publish(creds, payload: PublishPayload): Promise<PublishResult> {
    const pageId = creds.externalUserId;
    if (!pageId) return { ok: false, error: "No Facebook Page is connected." };
    const token = creds.accessToken;
    const media = payload.media ?? [];

    try {
      if (media.length > 0) {
        const video = media.find((m) => (m.mimeType ?? "").startsWith("video/"));
        if (video) {
          if (!video.url || !video.url.startsWith("http")) return { ok: false, error: "Facebook videos require a public video URL." };
          const res = await graphFetch(`${GRAPH}/${pageId}/videos?access_token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: video.url, description: payload.caption || undefined }),
          });
          return { ok: true, externalPostId: res.id, externalUrl: `https://www.facebook.com/${pageId}/videos/${res.id}` };
        }
        // Image post (attach up to the platform-imposed count with published=true).
        const first = media[0];
        if (first.url && (first.url.startsWith("http") || first.url.startsWith("https"))) {
          const res = await graphFetch(`${GRAPH}/${pageId}/photos?access_token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: first.url, caption: payload.caption || undefined }),
          });
          return { ok: true, externalPostId: res.id, externalUrl: `https://www.facebook.com/${pageId}/posts/${res.post_id ?? res.id}` };
        }
      }
      // Text / link post.
      const res = await graphFetch(`${GRAPH}/${pageId}/feed?access_token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: payload.caption,
          link: payload.linkUrl || undefined,
        }),
      });
      return { ok: true, externalPostId: res.id, externalUrl: `https://www.facebook.com/${pageId}/posts/${res.post_id ?? res.id}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export default facebook;