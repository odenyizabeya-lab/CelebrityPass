"use client";

/**
 * Local (localStorage) cache for chat rooms.
 *
 * Purpose: the chat UI renders INSTANTLY and stays stable with zero or slow
 * network. Conversation meta + messages are read synchronously on open so the
 * header, composer and message area never wait on an API call. Network sync
 * happens afterward in the background and refreshes this cache.
 *
 * Every read is defensively sanitized so corrupt/old/invalid data can never
 * crash the chat — bad entries are simply dropped and the server fills in.
 */

export interface CachedConversation {
  id: string;
  celebrityId: string;
  status: string;
  muted: boolean;
  pinned: boolean;
}

export interface CachedCelebrity {
  id: string;
  slug: string;
  name: string;
  profession: string;
  profileImage: string;
  profileImageUrl: string;
  isVerified: boolean;
  chatAccountType: string;
  chatAccountLabel: string | null;
  online: boolean;
}

export interface CachedReadState {
  fanLastReadAt: string | null;
  teamLastReadAt: string | null;
}

export interface CachedMeta {
  conversation: CachedConversation;
  celebrity: CachedCelebrity;
  readState: CachedReadState;
}

/** Everything ChatRoom needs to open a conversation without any network. */
export interface ChatNowSeed {
  conversationId: string;
  celebrityId: string;
  celebritySlug: string;
  celebrityName: string;
  profileImage: string;
  isVerified: boolean;
  savedAt: string;
}

const META_PREFIX = "cp.chat.meta.v1.";
const MSGS_PREFIX = "cp.chat.msgs.v1.";
const SEED_PREFIX = "cp.chat.seed.v1.";

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function storage(): Storage | null {
  try {
    if (
      typeof window === "undefined" ||
      typeof window.localStorage === "undefined"
    ) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Normalize arbitrary parsed JSON into a safe CachedMeta (null if unusable). */
export function sanitizeMeta(value: unknown): CachedMeta | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  const conv = s.conversation as Record<string, unknown> | null | undefined;
  const cel = s.celebrity as Record<string, unknown> | null | undefined;
  if (!conv || typeof conv !== "object" || !asText(conv.id)) return null;

  const conversation: CachedConversation = {
    id: asText(conv.id),
    celebrityId: asText(conv.celebrityId),
    status: asText(conv.status) || "ACTIVE",
    muted: Boolean(conv.muted),
    pinned: Boolean(conv.pinned),
  };

  const celebrity: CachedCelebrity = {
    id: cel && asText(cel.id) ? asText(cel.id) : asText(conv.celebrityId),
    slug: cel ? asText(cel.slug) : "",
    name: cel ? asText(cel.name) : "",
    profession: cel ? asText(cel.profession) : "",
    profileImage: cel ? asText(cel.profileImage) : "",
    profileImageUrl: cel ? asText(cel.profileImageUrl) : "",
    isVerified: Boolean(cel?.isVerified),
    chatAccountType: cel ? asText(cel.chatAccountType) : "",
    chatAccountLabel:
      cel && typeof cel.chatAccountLabel === "string" && cel.chatAccountLabel !== ""
        ? cel.chatAccountLabel
        : null,
    online: Boolean(cel?.online),
  };

  const rs = (s.readState ?? {}) as Record<string, unknown>;
  const readState: CachedReadState = {
    fanLastReadAt:
      typeof rs.fanLastReadAt === "string" ? rs.fanLastReadAt : null,
    teamLastReadAt:
      typeof rs.teamLastReadAt === "string" ? rs.teamLastReadAt : null,
  };

  return { conversation, celebrity, readState };
}

export function readMetaCache(conversationId: string): CachedMeta | null {
  const st = storage();
  if (!st) return null;
  try {
    const raw = st.getItem(META_PREFIX + conversationId);
    if (!raw) return null;
    return sanitizeMeta(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeMetaCache(conversationId: string, meta: CachedMeta): void {
  const st = storage();
  if (!st) return;
  try {
    st.setItem(META_PREFIX + conversationId, JSON.stringify(meta));
  } catch {
    // Storage full/blocked — chat still works, just without the offline cache.
  }
}

/** Keep only object entries; ChatRoom re-normalizes each via normalizeMessage. */
export function readMessagesCache(conversationId: string): unknown[] {
  const st = storage();
  if (!st) return [];
  try {
    const raw = st.getItem(MSGS_PREFIX + conversationId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((m) => m && typeof m === "object")
      : [];
  } catch {
    return [];
  }
}

export function writeMessagesCache(
  conversationId: string,
  messages: unknown[]
): void {
  const st = storage();
  if (!st) return;
  try {
    st.setItem(MSGS_PREFIX + conversationId, JSON.stringify(messages));
  } catch {
    // Storage full/blocked — handled silently.
  }
}

export function sanitizeSeed(value: unknown): ChatNowSeed | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  if (!asText(s.conversationId)) return null;
  return {
    conversationId: asText(s.conversationId),
    celebrityId: asText(s.celebrityId),
    celebritySlug: asText(s.celebritySlug),
    celebrityName: asText(s.celebrityName),
    profileImage: asText(s.profileImage),
    isVerified: Boolean(s.isVerified),
    savedAt: asText(s.savedAt),
  };
}

/**
 * Seeds let the "Chat Now" button navigate to an already-known conversation
 * instantly (cached on the first successful open) instead of waiting on the
 * find-or-create API. Both the celebrity id and slug keys are written, so a
 * lookup by either works.
 */
export function readChatNowSeed(key: string): ChatNowSeed | null {
  const st = storage();
  if (!st) return null;
  try {
    const raw =
      st.getItem(SEED_PREFIX + key) ?? st.getItem(SEED_PREFIX + "slug:" + key);
    if (!raw) return null;
    return sanitizeSeed(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeChatNowSeed(key: string, seed: ChatNowSeed): void {
  const st = storage();
  if (!st) return;
  try {
    st.setItem(SEED_PREFIX + key, JSON.stringify(seed));
    if (seed.celebritySlug) {
      st.setItem(SEED_PREFIX + "slug:" + seed.celebritySlug, JSON.stringify(seed));
    }
  } catch {
    // Storage full/blocked — handled silently.
  }
}

const DRAFT_PREFIX = "cp.chat.draft.v1.";

/**
 * A persisted composer draft. Only image drafts are stored (as a data URL)
 * because a `File` cannot be serialized; text uses the plain string.
 * Image drafts over ~2.5 MB are skipped so a single photo can't blow the
 * localStorage quota and wipe out the message + meta caches.
 */
export interface ChatDraft {
  text: string;
  image: { name: string; type: string; dataUrl: string } | null;
  updatedAt: string;
}

const DRAFT_IMAGE_MAX = 2_500_000;

/** Reads the saved draft for a conversation (null/absent if none). */
export function readDraftCache(conversationId: string): ChatDraft | null {
  const st = storage();
  if (!st) return null;
  try {
    const raw = st.getItem(DRAFT_PREFIX + conversationId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const d = parsed as Record<string, unknown>;
    const image =
      d.image && typeof d.image === "object"
        ? ({
            name: asText((d.image as Record<string, unknown>).name),
            type: asText((d.image as Record<string, unknown>).type),
            dataUrl: asText((d.image as Record<string, unknown>).dataUrl),
          } as ChatDraft["image"])
        : null;
    if (image && (!image.dataUrl || image.dataUrl.length > DRAFT_IMAGE_MAX)) {
      return { text: asText(d.text), image: null, updatedAt: asText(d.updatedAt) };
    }
    return {
      text: asText(d.text),
      image,
      updatedAt: asText(d.updatedAt),
    };
  } catch {
    return null;
  }
}

/** Persists the composer draft; oversized images are dropped, never stored. */
export function writeDraftCache(
  conversationId: string,
  text: string,
  image: { name: string; type: string; dataUrl: string } | null
): void {
  const st = storage();
  if (!st) return;
  try {
    const safeImage =
      image && image.dataUrl && image.dataUrl.length <= DRAFT_IMAGE_MAX
        ? image
        : null;
    st.setItem(
      DRAFT_PREFIX + conversationId,
      JSON.stringify({
        text,
        image: safeImage,
        updatedAt: new Date().toISOString(),
      } satisfies ChatDraft)
    );
  } catch {
    // Storage full/blocked — the draft just isn't persisted across reloads.
  }
}

/** Clears the saved draft after a successful send. */
export function clearDraftCache(conversationId: string): void {
  const st = storage();
  if (!st) return;
  try {
    st.removeItem(DRAFT_PREFIX + conversationId);
  } catch {
    // Ignore.
  }
}

/** Converts a persisted draft image back into a usable File (null if broken). */
export function draftImageToFile(
  name: string,
  type: string,
  dataUrl: string
): File | null {
  try {
    const idx = dataUrl.indexOf(",");
    if (idx < 0) return null;
    const meta = dataUrl.slice(5, idx);
    const mime = /^[a-z]+\/[a-z0-9.+-]+/i.exec(meta)?.[0] ?? type;
    const b64 = dataUrl.slice(idx + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name || "draft-image", { type: mime });
  } catch {
    return null;
  }
}

/** All conversation ids that have a cached message list (for the outbox). */
export function listCachedConversationIds(): string[] {
  const st = storage();
  if (!st) return [];
  try {
    const ids: string[] = [];
    for (let i = 0; i < st.length; i += 1) {
      const key = st.key(i);
      if (key && key.startsWith(MSGS_PREFIX)) {
        ids.push(key.slice(MSGS_PREFIX.length));
      }
    }
    return ids;
  } catch {
    return [];
  }
}

/**
 * Reads every cached conversation's messages so the app-wide outbox can retry
 * messages that were accepted locally (queued) but never acknowledged — even
 * for conversations the user hasn't reopened after reconnecting.
 */
export function readCachedMessageLists(): Array<{
  conversationId: string;
  messages: unknown[];
}> {
  return listCachedConversationIds().map((conversationId) => ({
    conversationId,
    messages: readMessagesCache(conversationId),
  }));
}