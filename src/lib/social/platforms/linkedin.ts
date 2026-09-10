/**
 * LinkedIn adapter — official LinkedIn v2 REST API.
 *
 *   Auth      https://www.linkedin.com/oauth/v2/authorization
 *   Tokens    https://www.linkedin.com/oauth/v2/accessToken
 *   Userinfo  GET https://api.linkedin.com/rest/userinfo   (OpenID Connect)
 *   Post      POST https://api.linkedin.com/rest/posts
 *
 * Requires a LinkedIn app with the w_member_social product. Publishing
 * requires the linkedin-x-entity-migration header in current API versions.
 */

import type { AccountCredentials, OAuthTokenResponse, PublishPayload, PublishResult, SocialAdapter } from "../types";

const AUTH = "https://www.linkedin.com/oauth/v2";
const API = "https://api.linkedin.com";
const TOKEN_URL = `${AUTH}/accessToken`;

interface LinkedInErrorField {
  message?: string;
}

interface LinkedInResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
  message?: string;
  serviceErrorCode?: LinkedInErrorField[];
  id?: string;
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  [key: string]: unknown;
}

async function linkedInFetch(url: string, init?: RequestInit): Promise<LinkedInResponse> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: LinkedInResponse | null = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    const msg = json?.message ?? (Array.isArray(json?.serviceErrorCode) ? json.serviceErrorCode.map((e) => e.message).join("; ") : `LinkedIn API ${res.status}`);
    throw new Error(String(msg));
  }
  return json ?? {};
}

const linkedin: SocialAdapter = {
  key: "linkedin",
  name: "LinkedIn",
  capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 3000, maxImages: 9 },
  oauth: true,

  buildAuthUrl({ clientId, redirectUri, state, scopes }) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: scopes.join(" "),
    });
    return `${AUTH}/authorization?${params.toString()}`;
  },

  async exchangeCode({ clientId, clientSecret, redirectUri, code }): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error_description ?? json?.error ?? `LinkedIn token error ${res.status}`);
    return { accessToken: json.access_token, expiresInSeconds: json.expires_in * 1000 ? json.expires_in : undefined, scopes: json.scope?.split(" ") };
  },

  async refreshToken(): Promise<OAuthTokenResponse> {
    throw new Error("LinkedIn access tokens are short-lived; re-connect the account to refresh.");
  },

  async verifyConnection(creds: AccountCredentials) {
    const me = await linkedInFetch(`${API}/rest/userinfo`, {
      headers: { Authorization: `Bearer ${creds.accessToken}`, "LinkedIn-Version": "202401" },
    });
    return {
      ok: true,
      externalUserId: me?.sub ?? undefined,
      externalUsername: me?.name ? `${me.given_name ?? ""} ${me.family_name ?? ""}`.trim() : me?.preferred_username ?? undefined,
      externalUrl: me?.sub ? `https://www.linkedin.com/in/${me.sub}` : undefined,
      accountType: "person",
      profile: me,
    };
  },

  async publish(creds, payload: PublishPayload): Promise<PublishResult> {
    const author = `urn:li:person:${creds.externalUserId}`;
    const content: Record<string, unknown> = {
      commentary: payload.caption || undefined,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED" },
      lifecycleState: "PUBLISHED",
    };

    const media = payload.media ?? [];
    if (media.length > 0) {
      const image = media.find((m) => (m.mimeType ?? "").startsWith("image/")) ?? media[0];
      content.content = {
        "com.linkedin.ugc.MemberShareContent": {
          shareMediaCategory: "IMAGE",
          media: [{ status: "READY", media: image.url || undefined }],
        },
      };
    }

    try {
      const post = await linkedInFetch(`${API}/rest/posts?author=${encodeURIComponent(author)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": "202401",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(content),
      });
      const urn = typeof post === "string" ? post : post?.id;
      return { ok: true, externalPostId: urn ?? undefined, externalUrl: `https://www.linkedin.com/feed/update/${urn}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/not.?allowed|permission|w_member_social|product|approval|privacy/i.test(msg)) {
        return { ok: false, error: "LinkedIn refused the post — requires the w_member_social product approved for your app.", requiresApproval: true, detail: msg };
      }
      return { ok: false, error: msg, detail: msg };
    }
  },
};

export default linkedin;