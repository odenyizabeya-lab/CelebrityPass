/**
 * Instagram adapter — official Instagram Content Publishing API (Graph API).
 *
 *   Connect    Facebook OAuth → /me/accounts (page) → /{page}/instagram_business_account
 *              The IG business account id is stored as the account id; the page
 *              access token is stored as the account token.
 *   Publish    POST /{ig-user-id}/media   →  container id
 *              POST /{ig-user-id}/media_publish  { creation_id }
 *
 * Requires a Professional (Business/Creator) account linked to a Facebook Page.
 */

import type { AccountCredentials, OAuthTokenResponse, PublishPayload, PublishResult, SocialAdapter } from "../types";

const GRAPH = "https://graph.facebook.com/v21.0";

interface GraphError {
  message?: string;
}

interface GraphResponse {
  id?: string;
  access_token?: string;
  expires_in?: number;
  error?: GraphError;
  username?: string;
  profile_picture_url?: string;
  instagram_business_account?: { id?: string; username?: string };
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

const instagram: SocialAdapter = {
  key: "instagram",
  name: "Instagram",
  capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 2200, maxImages: 1 },
  oauth: true,

  buildAuthUrl({ clientId, redirectUri, state, scopes }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: scopes.join(","),
    });
    return `${GRAPH.replace("/v21.0", "")}/v21.0/dialog/oauth?${params.toString()}`;
  },

  async exchangeCode({ clientId, clientSecret, redirectUri, code }): Promise<OAuthTokenResponse> {
    const url = `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
    const json = await graphFetch(url);
    if (!json.access_token) throw new Error("Meta did not return an access token.");
    return { accessToken: json.access_token, expiresInSeconds: json.expires_in, raw: json };
  },

  async refreshToken({ clientId, clientSecret, refreshToken }): Promise<OAuthTokenResponse> {
    const url = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&fb_exchange_token=${encodeURIComponent(refreshToken)}`;
    const json = await graphFetch(url);
    return { accessToken: json.access_token, expiresInSeconds: json.expires_in, raw: json };
  },

  async verifyConnection(creds: AccountCredentials) {
    // The stored account is the IG business account; parent page id lives in rawProfile.
    let pageId = "";
    let igId = creds.externalUserId ?? "";
    if (creds.rawProfile) {
      try {
        const parsed = JSON.parse(creds.rawProfile);
        pageId = parsed.pageId ?? "";
        igId = parsed.igUserId ?? igId;
      } catch {}
    }

    if (!igId && pageId) {
      const page = await graphFetch(`${GRAPH}/${pageId}?fields=instagram_business_account{id,username,followers_count,profile_picture_url}`, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      }).catch(() => null);
      igId = page?.instagram_business_account?.id ?? "";
    }
    if (!igId) {
      return { ok: false, error: "No Instagram business account is linked to the connected Facebook Page." };
    }
    const me = await graphFetch(`${GRAPH}/${igId}?fields=username,profile_picture_url,follower_count`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    }).catch(() => null);
    return {
      ok: true,
      externalUserId: igId,
      externalUsername: me?.username ?? igId,
      externalUrl: me?.username ? `https://www.instagram.com/${me.username}` : undefined,
      accountType: "business",
      profile: { igUserId: igId, username: me?.username, pageId },
    };
  },

  async publish(creds, payload: PublishPayload): Promise<PublishResult> {
    const igId = creds.externalUserId;
    if (!igId) return { ok: false, error: "No Instagram business account is connected." };
    const token = creds.accessToken;
    const media = payload.media ?? [];

    try {
      let containerPayload: Record<string, unknown>;
      const video = media.find((m) => (m.mimeType ?? "").startsWith("video/"));
      if (video) {
        if (!video.url?.startsWith("http")) return { ok: false, error: "Instagram video posts require a public video URL." };
        containerPayload = {
          media_type: "REELS",
          video_url: video.url,
          caption: payload.caption || undefined,
          share_to_feed: true,
        };
      } else if (media[0]?.url) {
        const m = media[0];
        containerPayload = {
          image_url: m.url.startsWith("http") ? m.url : undefined,
          caption: payload.caption || undefined,
        };
        if (!containerPayload.image_url) {
          return { ok: false, error: "Instagram image posts require a public image URL (data-URIs are not accepted by the Content Publishing API)." };
        }
      } else {
        return { ok: false, error: "Instagram posts require an image or video." };
      }

      const container = await graphFetch(`${GRAPH}/${igId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...containerPayload, access_token: token }),
      });
      if (!container.id) return { ok: false, error: "Instagram created no media container." };

      // Publish the container.
      let published: GraphResponse | null = null;
      for (let i = 0; i < 10; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 2000));
        published = await graphFetch(`${GRAPH}/${igId}/media_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: container.id, access_token: token }),
        }).catch(() => null);
        if (published?.id) break;
      }
      if (!published?.id) {
        return { ok: false, error: "Instagram did not confirm the publish (container may still be processing).", detail: JSON.stringify(published ?? container) };
      }
      return {
        ok: true,
        externalPostId: String(published.id),
        externalUrl: creds.externalUsername ? `https://www.instagram.com/p/${container.id}/` : undefined,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/not allowed|permission|professional|business|content publishing/i.test(msg)) {
        return { ok: false, error: "Instagram refused publishing — requires a Professional account with content_publish permission.", requiresApproval: true, detail: msg };
      }
      return { ok: false, error: msg, detail: msg };
    }
  },
};

export default instagram;