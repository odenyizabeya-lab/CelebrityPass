/**
 * Shared types for the Social Media Publishing system.
 *
 * These types describe the platform adapters, the database records they read
 * and write, and the payload shapes exchanged with the admin UI.
 */

export type PlatformKey =
  | "tiktok"
  | "telegram"
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "youtube"
  | "x"
  | "pinterest"
  | "linkedin";

export type ContentType = "celebrity" | "membership" | "event" | "article" | "promo";

export type QueueStatus =
  | "DRAFT"
  | "QUEUED"
  | "SCHEDULED"
  | "APPROVAL_REQUIRED"
  | "PROCESSING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED"
  | "SKIPPED";

export type PostSource = "AUTO" | "MANUAL" | "PROMO";

/** What one platform adapter can post. */
export interface PlatformCapabilities {
  text: boolean;
  image: boolean;
  video: boolean;
  /** True if the platform requires a connected account (tagged owner) to post. */
  requiresAccount: boolean;
  /** Max characters for a text caption (0 = unlimited). */
  maxCaption?: number;
  maxImages?: number;
  maxVideoMb?: number;
}

/** A media item attached to a post, exactly as stored in queue/post mediaJson. */
export interface SocialMediaRef {
  /** DB asset id when the media was uploaded through the dashboard. */
  assetId?: string;
  /** Public URL / data-URI of the media. */
  url?: string;
  /** Stored mime type. */
  mimeType?: string;
  /** Human file name. */
  name?: string;
  sizeBytes?: number;
}

/** Payload every platform adapter consumes. */
export interface PublishPayload {
  caption: string;
  title?: string;
  linkUrl?: string;
  media: SocialMediaRef[];
  contentType?: string;
  contentRefId?: string;
}

/** Result returned by a platform adapter after a publish attempt. */
export interface PublishResult {
  ok: boolean;
  externalPostId?: string;
  externalUrl?: string;
  error?: string;
  /** Platform-specific status detail (safe, no tokens). */
  detail?: string;
  /** If posting requires approval on the platform side, say so. */
  requiresApproval?: boolean;
}

/** A resolved, live credential bundle for one connected account. */
export interface AccountCredentials {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date | null;
  externalUserId?: string | null;
  externalUsername?: string | null;
  rawProfile?: string | null;
}

/** OAuth exchange result from a provider. */
export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  scopes?: string[];
  raw?: Record<string, unknown>;
}

/** Defines the interface every platform adapter implements. */
export interface SocialAdapter {
  readonly key: PlatformKey;
  /** Human label, e.g. "TikTok". */
  name: string;
  capabilities: PlatformCapabilities;
  /**
   * True when posting requires OAuth (as opposed to a long-lived token that
   * is entered directly, like a Telegram bot token).
   */
  oauth: boolean;
  /** Admin-facing prose about credentials/approval requirements. */
  howToConnect?: string;
  /**
   * Build the authorization URL that starts the OAuth flow.
   * Returns null when the platform is token-based instead of OAuth-based.
   */
  buildAuthUrl(args: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: string[];
  }): string | null;
  /** Exchange an authorization code for tokens. */
  exchangeCode(args: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
  }): Promise<OAuthTokenResponse>;
  /** Refresh an expired access token. */
  refreshToken(args: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<OAuthTokenResponse>;
  /**
   * Verify the account is still connected and refresh cached identity.
   * Returns a safe summary for the dashboard.
   */
  verifyConnection(creds: AccountCredentials): Promise<{
    ok: boolean;
    externalUserId?: string;
    externalUsername?: string;
    externalUrl?: string;
    accountType?: string;
    profile?: object;
    error?: string;
  }>;
  /** Publish a post through the official API. */
  publish(creds: AccountCredentials, payload: PublishPayload): Promise<PublishResult>;
}

/** Registry metadata used by the dashboard (mirrors DB, but static + cheap). */
export interface PlatformMeta {
  key: PlatformKey;
  name: string;
  color: string;
  oauth: boolean;
  capabilities: PlatformCapabilities;
  requiresApproval: boolean;
  approvalNote: string;
  credentialEnvKeys: string[];
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  howToConnect?: string;
}