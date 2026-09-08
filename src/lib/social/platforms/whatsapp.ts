/**
 * WhatsApp Channels adapter — official Meta Graph API only.
 *
 * WhatsApp Channels use a verified WhatsApp Business Account + System User
 * token. Credentials are token-entry (WHATSAPP_TOKEN, WHATSAPP_CHANNEL_ID,
 * WHATSAPP_PHONE_ID) set in server env vars.
 *
 * The Graph API messages endpoint is the official broadcast path; if the
 * account is not verified/approved for Channels, Meta returns an error that is
 * surfaced untouched.
 *
 *   POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
 */

import type { AccountCredentials, OAuthTokenResponse, PublishPayload, PublishResult, SocialAdapter } from "../types";

const GRAPH = "https://graph.facebook.com/v21.0";

interface GraphError {
  message?: string;
}

interface GraphResponse {
  id?: string;
  name?: string;
  error?: GraphError;
  messages?: { id?: string }[];
  [key: string]: unknown;
}

async function graphCall(path: string, token: string, body?: unknown): Promise<GraphResponse> {
  const res = await fetch(`${GRAPH}${path}`, {
    method: body !== undefined ? "POST" : "GET",
    headers: body !== undefined ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json: GraphResponse | null = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message ?? `Graph API ${res.status}`;
    throw new Error(msg);
  }
  return json ?? {};
}

const whatsapp: SocialAdapter = {
  key: "whatsapp",
  name: "WhatsApp Channels",
  capabilities: { text: true, image: true, video: true, requiresAccount: true, maxCaption: 0, maxImages: 1 },
  oauth: false,

  buildAuthUrl() {
    return null;
  },

  async exchangeCode(): Promise<OAuthTokenResponse> {
    throw new Error("WhatsApp uses a System User token, not OAuth — enter it in the dashboard.");
  },

  async refreshToken(): Promise<OAuthTokenResponse> {
    throw new Error("WhatsApp System User tokens are long-lived and refreshed at Meta Business Suite.");
  },

  async verifyConnection(creds: AccountCredentials) {
    try {
      const me = await graphCall("/me", creds.accessToken);
      const wabaId = creds.rawProfile ? JSON.parse(creds.rawProfile).wabaId : process.env.WHATSAPP_CHANNEL_ID;
      return {
        ok: true,
        externalUserId: wabaId ?? String(me?.id ?? ""),
        externalUsername: me?.name ?? creds.externalUsername ?? `WABA ${String(me?.id ?? "").slice(-6)}`,
        externalUrl: "https://business.facebook.com/wa/",
        accountType: "business",
        profile: { id: me?.id, name: me?.name },
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  async publish(creds, payload: PublishPayload): Promise<PublishResult> {
    if (!creds.accessToken) return { ok: false, error: "WhatsApp System User token is not configured (WHATSAPP_TOKEN)." };

    const media = payload.media ?? [];
    let type: string = "text";
    let content: Record<string, unknown> = {};
    if (media.length > 0) {
      const m = media[0];
      if ((m.mimeType ?? "").startsWith("video/")) {
        type = "video";
        content = { link: m.url };
      } else if (m.url && (m.url.startsWith("http") || m.url.startsWith("https"))) {
        type = "image";
        content = { link: m.url };
      } else {
        return { ok: false, error: "WhatsApp image posts require a public image URL (data-URI uploads are not supported by the Graph API)." };
      }
      if (payload.caption) content.caption = payload.caption;
    } else {
      content = { preview_url: false, body: payload.caption };
    }

    try {
      const result = await graphCall(`/${creds.externalUserId || process.env.WHATSAPP_CHANNEL_ID || ""}/messages`, creds.accessToken, {
        messaging_product: "whatsapp",
        to: process.env.WHATSAPP_RECIPIENT_ID || creds.externalUsername || undefined,
        recipient_type: "channel",
        type,
        [type]: content,
      });
      return { ok: true, externalPostId: String(result?.messages?.[0]?.id ?? ""), detail: "Message accepted by WhatsApp." };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Channels broadcast failures usually point to verification/approval.
      if (/(not eligible|permission|unverified|business)verification|approval|channel/i.test(msg)) {
        return { ok: false, error: "WhatsApp refused the broadcast — Channels requires a verified WhatsApp Business Account.", requiresApproval: true, detail: msg };
      }
      return { ok: false, error: msg, detail: msg };
    }
  },
};

export default whatsapp;