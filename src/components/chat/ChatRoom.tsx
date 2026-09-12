"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useChatRealtime } from "@/hooks/useChatRealtime";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  readMetaCache,
  readMessagesCache,
  writeChatNowSeed,
  writeMetaCache,
  writeMessagesCache,
  type CachedMeta,
} from "@/lib/chat/local-cache";
import MessageBubble from "./MessageBubble";
import AttachmentLightbox, { type LightboxAttachment } from "./AttachmentLightbox";
import CallOverlay from "./CallOverlay";
import LockedPremium from "./LockedPremium";
import VerifiedBadge from "@/components/VerifiedBadge";

interface ReplyTo {
  id: string;
  senderType: string;
  type: string;
  body: string;
  deletedAt: string | null;
}

interface Msg {
  id: string;
  conversationId: string;
  senderType: "fan" | "team" | "system";
  fanId: string | null;
  teamEmail: string | null;
  clientId: string;
  type: string;
  body: string;
  attachmentJson: string | null;
  status: string;
  deliveredAt: string | null;
  readAt: string | null;
  repliedToId: string | null;
  repliedTo: ReplyTo | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeMessage(raw: Record<string, unknown> | null | undefined): Msg | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw;
  const id = asText(s.id) || asText(s.clientId);
  if (!id) return null;
  const repliedToRaw =
    s.repliedTo && typeof s.repliedTo === "object"
      ? (s.repliedTo as Record<string, unknown>)
      : null;
  return {
    id,
    conversationId: asText(s.conversationId),
    senderType:
      s.senderType === "fan" || s.senderType === "system" ? s.senderType : "team",
    fanId: typeof s.fanId === "string" ? s.fanId : null,
    teamEmail: typeof s.teamEmail === "string" ? s.teamEmail : null,
    clientId: asText(s.clientId),
    type: asText(s.type) || "text",
    body: typeof s.body === "string" ? s.body : "",
    attachmentJson: typeof s.attachmentJson === "string" ? s.attachmentJson : null,
    status: asText(s.status) || "PENDING",
    deliveredAt: asText(s.deliveredAt) || null,
    readAt: asText(s.readAt) || null,
    repliedToId: asText(s.repliedToId) || null,
    repliedTo: repliedToRaw
      ? {
          id: asText(repliedToRaw.id),
          senderType: typeof repliedToRaw.senderType === "string" ? repliedToRaw.senderType : "team",
          type: asText(repliedToRaw.type),
          body: typeof repliedToRaw.body === "string" ? repliedToRaw.body : "",
          deletedAt: asText(repliedToRaw.deletedAt) || null,
        }
      : null,
    editedAt: asText(s.editedAt) || null,
    deletedAt: asText(s.deletedAt) || null,
    createdAt: asText(s.createdAt),
  };
}

// The messages API returns the created message wrapped as { message: {...} }.
// Unwrap that (or accept a bare message object) so callers always hold a flat
// ChatMessage shape — passing a nested payload through as a Msg would render a
// bodyless bubble with an undefined id and a NaN-parsing createdAt.
function unwrapMessage(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const inner = obj.message;
  if (inner && typeof inner === "object") return inner as Record<string, unknown>;
  return obj.message === undefined ? obj : null;
}

interface ComposerProps {
  onSendText: (text: string) => void;
  onSendImage: (file: File, caption: string) => void;
  onSendVoice: (blob: Blob) => void;
  onTyping: () => void;
  disabled: boolean;
  unavailable: boolean;
}

function pickRecorderMime(): string | null {
  try {
    if (typeof MediaRecorder === "undefined") return null;
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/mpeg")) return "audio/mpeg";
  } catch {
    return null;
  }
  return null;
}

function Composer({ onSendText, onSendImage, onSendVoice, onTyping, disabled, unavailable }: ComposerProps) {
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSend = () => {
    if (disabled) return;
    if (pendingImage) {
      onSendImage(pendingImage.file, text.trim());
      setPendingImage((p) => {
        if (p) URL.revokeObjectURL(p.preview);
        return null;
      });
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 144) + "px";
    onTyping();
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setPendingImage((p) => {
        if (p) URL.revokeObjectURL(p.preview);
        return { file, preview: URL.createObjectURL(file) };
      });
    }
    e.target.value = "";
  };

  const startRecording = async () => {
    const mime = pickRecorderMime();
    if (!mime || !navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      // Microphone permission denied or recording unsupported — no-op.
    }
  };

  const finishRecording = () => {
    const mr = recorderRef.current;
    if (!mr) return;
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recorderRef.current = null;
      setRecording(false);
      setRecordSeconds(0);
      onSendVoice(blob);
    };
    mr.stop();
  };

  const cancelRecording = () => {
    const mr = recorderRef.current;
    if (mr) {
      mr.ondataavailable = null;
      mr.onstop = null;
      try {
        mr.stop();
      } catch {}
      mr.stream.getTracks().forEach((t) => t.stop());
    }
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recorderRef.current = null;
    setRecording(false);
    setRecordSeconds(0);
  };

  const recordLabel = `${String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:${String(recordSeconds % 60).padStart(2, "0")}`;

  return (
    <div className="relative border-t border-white/10 bg-ink-900 px-3 pb-2 pt-1">
      <div className="mx-auto max-w-3xl">
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage.preview}
              alt="Selected"
              className="h-12 w-12 rounded-lg object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
              {pendingImage.file.name}
            </span>
            <button
              onClick={() => {
                URL.revokeObjectURL(pendingImage.preview);
                setPendingImage(null);
              }}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-zinc-300 hover:bg-white/20"
              aria-label="Remove image"
            >
              ✕
            </button>
          </div>
        )}

        {recording ? (
          <div className="flex items-center gap-2 py-1.5">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm tabular-nums text-red-400">{recordLabel}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">
              Recording voice note…
            </span>
            <button
              onClick={finishRecording}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Send
            </button>
            <button
              onClick={cancelRecording}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-zinc-300 hover:bg-white/20"
              aria-label="Cancel recording"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5 rounded-[28px] bg-white/10 p-1.5">
            <button
              onClick={async () => {
                const { isNativePlatform } = await import("@/lib/native");
                if (isNativePlatform()) {
                  try {
                    const { captureImageFromNative } = await import("@/lib/native");
                    const shot = await captureImageFromNative();
                    setPendingImage(shot);
                    return;
                  } catch {
                    fileRef.current?.click();
                    return;
                  }
                }
                fileRef.current?.click();
              }}
              disabled={disabled}
              className="grid h-10 w-10 shrink-0 place-items-center self-end rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 active:scale-90 disabled:opacity-40"
              title="Attach photo"
              aria-label="Attach photo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              placeholder={
                disabled && unavailable
                  ? "Chat unavailable"
                  : "Message..."
              }
              rows={1}
              className="max-h-[144px] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-[17px] leading-6 text-zinc-100 placeholder-zinc-500 caret-primary-400 outline-none disabled:opacity-50"
            />

            {text.trim() || pendingImage ? (
              <button
                onClick={handleSend}
                disabled={disabled}
                className="grid h-10 w-10 shrink-0 place-items-center self-end rounded-full bg-primary-600 text-white transition-all hover:bg-primary-500 active:scale-90 disabled:opacity-40"
                title="Send"
                aria-label="Send"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => void startRecording()}
                disabled={disabled}
                className="grid h-10 w-10 shrink-0 place-items-center self-end rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 active:scale-90 disabled:opacity-40"
                title="Record voice note"
                aria-label="Record voice note"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatRoom({ conversationId }: { conversationId: string }) {
  const [meta, setMeta] = useState<CachedMeta | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [isStuckToBottom, setIsStuckToBottom] = useState(true);
  const [metaStatus, setMetaStatus] = useState<"ready" | "unavailable">("ready");
  const [metaTransient, setMetaTransient] = useState(false);
  const [messagesFailed, setMessagesFailed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [retryTick, setRetryTick] = useState(0);
  const [online, setOnline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [lightboxAttachment, setLightboxAttachment] = useState<LightboxAttachment | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [callMode, setCallMode] = useState<"voice" | "video">("voice");
  const [callSession, setCallSession] = useState(0);
  const [premiumGate, setPremiumGate] = useState<"voice" | "video" | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  // Live mirror of `messages` so the outbox flusher can read the latest list
  // from an effect/interval without a stale closure.
  const messagesRef = useRef<Msg[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const inFlightRef = useRef<Set<string>>(new Set());
  const metaStatusRef = useRef<"ready" | "unavailable">("ready");
  useEffect(() => {
    metaStatusRef.current = metaStatus;
  }, [metaStatus]);
  const { state: pushState, enable: enablePush, disable: disablePush } = usePushNotifications();
  const router = useRouter();

  // INSTANT OPEN — hydrate conversation + messages from local cache BEFORE the
  // first paint. The full chat UI (header, composer, cached messages) shows
  // immediately; network sync happens below in the background and refreshes
  // the cache. Corrupt/missing cache is simply ignored and the server fills in.
  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const cachedMeta = readMetaCache(conversationId);
    if (cachedMeta) {
      setMeta(cachedMeta);
      setMetaStatus("ready");
      setOnline(cachedMeta.celebrity?.online ?? false);
      setPremiumUnlocked(true);
    }
    const cachedMessages = readMessagesCache(conversationId);
    if (cachedMessages.length > 0) {
      const list: Msg[] = cachedMessages
        .map((m) => normalizeMessage(m as Record<string, unknown>))
        .filter((m): m is Msg => m !== null);
      if (list.length > 0) {
        setMessages((prev) => (list.length > prev.length ? list : prev));
        setHasMore(true);
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [conversationId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [since, setSince] = useState<string | null>(null);

  // Tracks the visual viewport height so the composer stays pinned above the
  // Android keyboard while it is open and returns to the bottom when closed.
  const [visualHeight, setVisualHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVisualHeight(vv.height > 0 ? vv.height : null);
    update();
    vv.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      vv.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const retry = useCallback(() => setRetryTick((t) => t + 1), []);

  // Atomically replace the optimistic copy of a just-acknowledged send with the
  // server's flat message (matched by clientId). Degenerate/nested payloads are
  // dropped — the optimistic copy stays put (and queued) until a real ack.
  const reconcileSent = useCallback((clientId: string, payload: unknown) => {
    const raw = unwrapMessage(payload);
    if (!raw) return;
    const normalized = normalizeMessage(raw);
    if (!normalized) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.clientId === clientId
          ? {
              ...normalized,
              id: normalized.id || m.id,
              createdAt: normalized.createdAt || m.createdAt,
            }
          : m
      )
    );
  }, []);

  // Offline outbox: messages that were accepted locally but never acked by the
  // server are re-sent automatically when the network returns. The server's
  // (conversationId, clientId) unique constraint makes retries idempotent, so
  // a re-send can never create a duplicate row on the wire.
  const flushOutbox = useCallback(async () => {
    const queued = messagesRef.current.filter(
      (m) =>
        m.senderType === "fan" &&
        (m.status === "PENDING" || m.status === "FAILED") &&
        m.id.startsWith("temp-") &&
        (m.type === "text" || m.attachmentJson != null)
    );
    for (const msg of queued) {
      if (inFlightRef.current.has(msg.clientId)) continue;
      inFlightRef.current.add(msg.clientId);
      try {
        const attachmentJson = msg.attachmentJson
          ? JSON.parse(msg.attachmentJson)
          : undefined;
        const res = await fetch(`/api/chat/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: msg.clientId,
            type: msg.type,
            body: msg.body,
            ...(attachmentJson ? { attachmentJson } : {}),
          }),
        });
        if (res.ok) {
          reconcileSent(msg.clientId, await res.json().catch(() => null));
        }
      } catch {
        // Still queued; the next sync attempt retries it.
      } finally {
        inFlightRef.current.delete(msg.clientId);
      }
    }
  }, [conversationId, reconcileSent]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  // Browser online/offline — the chat shell stays open either way. When the
  // network comes back (or the tab regains focus) we automatically refetch.
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) retry();
    wasOnlineRef.current = isOnline;
  }, [isOnline, retry]);

  useEffect(() => {
    const update = () =>
      setIsOnline(document.visibilityState !== "hidden" && navigator.onLine !== false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // Gentle background retry while a load is failing so recovery happens
  // automatically even without an explicit network event.
  useEffect(() => {
    if (!metaTransient && !messagesFailed) return;
    const id = setInterval(() => {
      if (navigator.onLine !== false) retry();
    }, 15000);
    return () => clearInterval(id);
  }, [metaTransient, messagesFailed, retry]);

  // Conversation meta. A 403/404 from the server is a DEFINITE "does not
  // exist" — only that shows "Conversation unavailable". Any other failure
  // (no network, server down) keeps the shell standing and retries.
  useEffect(() => {
    if (metaStatusRef.current === "unavailable") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/${conversationId}`);
        if (cancelled) return;
        if (res.status === 401) {
          window.location.replace(`/login?next=${encodeURIComponent(`/chat/${conversationId}`)}`);
          return;
        }
        if (res.status === 403 || res.status === 404) {
          setMetaStatus("unavailable");
          setMetaTransient(false);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMeta(data);
        setMetaStatus("ready");
        setMetaTransient(false);
        setOnline(Boolean(data.celebrity?.online));
        setPremiumUnlocked(Boolean(data.premium?.unlocked ?? true));
        setBlocked(false);
        // Persist so the NEXT open (incl. offline) renders instantly.
        writeMetaCache(conversationId, data);
        const c = data.celebrity;
        if (c?.id) {
          writeChatNowSeed(c.id, {
            conversationId,
            celebrityId: c.id,
            celebritySlug: String(c.slug ?? ""),
            celebrityName: String(c.name ?? ""),
            profileImage: String(c.profileImage ?? ""),
            isVerified: Boolean(c.isVerified),
            savedAt: new Date().toISOString(),
          });
        }
      } catch {
        if (!cancelled) {
          setMetaTransient(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, retryTick]);

  useEffect(() => {
    if (!meta || metaStatus === "unavailable") return;
    let disposed = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/${conversationId}/messages?limit=50`);
        if (disposed) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: Msg[] = Array.isArray(data.messages)
          ? (data.messages as unknown[]).map((m) => normalizeMessage(m as Record<string, unknown>)).filter((m): m is Msg => m !== null)
          : [];
        setMessages(list);
        setHasMore(Boolean(data.hasMore));
        const latest = list[list.length - 1];
        if (latest?.createdAt) setSince(latest.createdAt);
        setMessagesFailed(false);
      } catch {
        if (!disposed) setMessagesFailed(true);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [meta, metaStatus, retryTick, conversationId]);

  // Persist whatever we currently hold so the next open is instant/offline.
  // Runs after hydration, realtime receives, optimistic sends, read/delivered
  // confirmations and load-older merges — always the latest known state.
  useEffect(() => {
    writeMessagesCache(conversationId, messages);
  }, [messages, conversationId]);

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last) return;
    fetch(`/api/chat/${conversationId}/read`, { method: "POST" }).catch(
      () => {}
    );
  }, [messages, conversationId]);

  useEffect(() => {
    if (isStuckToBottom && messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages, isStuckToBottom, scrollToBottom]);

  // Stay pinned to the latest message whenever the chat viewport resizes
  // (Android keyboard opening/closing, composer growing taller) — exactly like
  // a mobile messaging app.
  const stuckRef = useRef(isStuckToBottom);
  useEffect(() => {
    stuckRef.current = isStuckToBottom;
  }, [isStuckToBottom]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (stuckRef.current && el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { connected: rtConnected } = useChatRealtime(conversationId, since, {
    onMessage: (message: import("@/hooks/useChatRealtime").RealtimeMessage) => {
      const normalized = normalizeMessage(message as unknown as Record<string, unknown>);
      if (!normalized) return;
      setMessages((prev) => {
        // Our own sent message echoes back through SSE with the same clientId —
        // reconcile it over the optimistic copy instead of appending a duplicate.
        if (normalized.clientId && prev.some((m) => m.clientId === normalized.clientId)) {
          return prev.map((m) =>
            m.clientId === normalized.clientId
              ? {
                  ...normalized,
                  id: normalized.id || m.id,
                  createdAt: normalized.createdAt || m.createdAt,
                }
              : m
          );
        }
        if (prev.some((m) => m.id === normalized.id)) return prev;
        return [...prev, normalized];
      });
      if (normalized.createdAt) setSince(normalized.createdAt);
    },
    onRead: (event: {
      conversationId: string;
      messageId?: string | null;
      deliveredAt?: string | null;
      readAt?: string | null;
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === event.messageId
            ? {
                ...m,
                deliveredAt: event.deliveredAt ?? m.deliveredAt,
                readAt: event.readAt ?? m.readAt,
              }
            : m
        )
      );
    },
    onPresence: (online: boolean) => {
      setOnline(online);
    },
    onTyping: () => {
      setOtherTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setOtherTyping(false), 3500);
    },
  });

  // When the realtime stream reconnects, refetch history so cached (offline)
  // messages catch up with everything that happened while disconnected.
  const wasRtConnectedRef = useRef(rtConnected);
  useEffect(() => {
    if (rtConnected && !wasRtConnectedRef.current) {
      void flushOutbox();
      retry();
    }
    wasRtConnectedRef.current = rtConnected;
  }, [rtConnected, retry, flushOutbox]);

  // Auto-flush the offline outbox: on the browser "online" event, on focus or
  // on a fixed cadence while any message is still waiting for a server ack.
  useEffect(() => {
    const tryFlush = () => {
      if (navigator.onLine !== false) void flushOutbox();
    };
    const id = setInterval(tryFlush, 15000);
    window.addEventListener("online", tryFlush);
    window.addEventListener("focus", tryFlush);
    document.addEventListener("visibilitychange", tryFlush);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", tryFlush);
      window.removeEventListener("focus", tryFlush);
      document.removeEventListener("visibilitychange", tryFlush);
    };
  }, [flushOutbox]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsStuckToBottom(dist < 80);
  };

  const loadOlder = async () => {
    if (loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const firstId = messages[0].id;
      const res = await fetch(
        `/api/chat/${conversationId}/messages?limit=50&cursor=${firstId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const older: Msg[] = Array.isArray(data.messages)
        ? (data.messages as unknown[]).map((m) => normalizeMessage(m as Record<string, unknown>)).filter((m): m is Msg => m !== null)
        : [];
      setMessages((prev) => [
        ...older.filter((m) => !prev.some((p) => p.id === m.id)),
        ...prev,
      ]);
      setHasMore(data.hasMore ?? false);
    } finally {
      setLoadingOlder(false);
    }
  };

  const sendText = async (body: string) => {
    if (!meta || blocked) return;
    const clientId = crypto.randomUUID();
    const optimistic: Msg = {
      id: `temp-${clientId}`,
      conversationId,
      senderType: "fan",
      fanId: null,
      teamEmail: null,
      clientId,
      type: "text",
      body,
      attachmentJson: null,
      status: "PENDING",
      deliveredAt: null,
      readAt: null,
      repliedToId: null,
      repliedTo: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, type: "text", body }),
      });
      if (!res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientId === clientId ? { ...m, status: "FAILED" } : m
          )
        );
        return;
      }
      reconcileSent(clientId, await res.json().catch(() => null));
    } catch {
      // Network failure: keep the message locally, queued for the outbox.
      setMessages((prev) =>
        prev.map((m) =>
          m.clientId === clientId ? { ...m, status: "FAILED" } : m
        )
      );
    }
  };

  const sendTyping = () => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1000) return;
    lastTypingSentRef.current = now;
    fetch(`/api/chat/${conversationId}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typing: true }),
    }).catch(() => {});
  };

  const sendAttachmentMessage = async (
    clientId: string,
    type: string,
    body: string,
    file: File
  ) => {
    const optimistic: Msg = {
      id: `temp-${clientId}`,
      conversationId,
      senderType: "fan",
      fanId: null,
      teamEmail: null,
      clientId,
      type,
      body,
      attachmentJson: null,
      status: "PENDING",
      deliveredAt: null,
      readAt: null,
      repliedToId: null,
      repliedTo: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch(`/api/chat/${conversationId}/attachments`, {
        method: "POST",
        body: form,
      });
      if (!up.ok) throw new Error("Upload failed");
      const upload = await up.json();
      const attachmentJson = JSON.stringify(upload.attachment);
      // Keep the uploaded reference on the optimistic copy so the bubble can
      // render it and the queued send survives a refresh if the POST below
      // fails. The messages payload takes the OBJECT (not the stringified
      // version) so the API stores a single-encoded attachmentJson value.
      setMessages((prev) =>
        prev.map((m) =>
          m.clientId === clientId ? { ...m, attachmentJson } : m
        )
      );
      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          type,
          body,
          attachmentJson: upload.attachment,
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      reconcileSent(clientId, await res.json().catch(() => null));
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientId === clientId ? { ...m, status: "FAILED" } : m
        )
      );
    }
  };

  const sendImage = (file: File, caption: string) => {
    if (!meta || blocked) return;
    void sendAttachmentMessage(crypto.randomUUID(), "image", caption, file);
  };

  const sendVoice = (blob: Blob) => {
    if (!meta || blocked) return;
    let mime = blob.type || "audio/webm";
    if (mime.includes("webm")) {
      mime = "audio/webm";
    } else if (mime.includes("ogg")) {
      mime = "audio/ogg";
    } else {
      mime = "audio/mpeg";
    }
    const ext = mime === "audio/webm" ? "webm" : mime === "audio/ogg" ? "ogg" : "m4a";
    const file = new File([blob], `voice-${crypto.randomUUID().slice(0, 8)}.${ext}`, {
      type: mime,
    });
    void sendAttachmentMessage(crypto.randomUUID(), "voice", "", file);
  };

  const handleBlock = async () => {
    if (!meta) return;
    try {
      await fetch("/api/chat/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebrityId: meta.celebrity.id }),
      });
      setBlocked(true);
    } catch {}
    setMenuOpen(false);
  };

  const handleMute = async () => {
    if (!meta) return;
    try {
      await fetch(`/api/chat/${conversationId}/mute`, { method: "POST" });
      setMeta((prev) =>
        prev
          ? { ...prev, conversation: { ...prev.conversation, muted: !prev.conversation.muted } }
          : prev
      );
    } catch {}
    setMenuOpen(false);
  };

  const celebrity = meta?.celebrity;
  const conversation = meta?.conversation;
  const isDisabled =
    !conversation || conversation.status !== "ACTIVE" || blocked;

  const startCall = (mode: "voice" | "video") => {
    if (!meta || metaStatus !== "ready") return;
    if (!premiumUnlocked) {
      setPremiumGate(mode);
      return;
    }
    setCallMode(mode);
    setCallSession((s) => s + 1);
    setCallOpen(true);
  };

  const groupedMessages = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const isFirstInGroup =
      !prev || prev.senderType !== msg.senderType;
    const isLastInGroup =
      !next || next.senderType !== msg.senderType;
    return { msg, isFirstInGroup, isLastInGroup };
  });

  const headerControls = (
    <div className="flex items-center gap-1">
      <button
        onClick={() => {
          if (pushState === "subscribed") {
            void disablePush();
          } else if (pushState === "unsubscribed" || pushState === "unavailable") {
            void enablePush();
          }
        }}
        disabled={pushState === "unsupported" || pushState === "denied" || pushState === "loading"}
        className={`rounded-full p-2 transition ${
          pushState === "subscribed"
            ? "text-amber-400 hover:bg-white/10"
            : "text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
        }`}
        title={
          pushState === "subscribed"
            ? "Push notifications on"
            : pushState === "denied"
              ? "Notifications blocked in browser"
              : "Enable push notifications"
        }
        aria-label="Toggle push notifications"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      </button>
      <button
        onClick={() => startCall("voice")}
        className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
        title="Voice call"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
        </svg>
      </button>
      <button
        onClick={() => startCall("video")}
        className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
        title="Video call"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      </button>
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          title="More options"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full z-40 mt-1 w-48 overflow-hidden rounded-xl border border-white/10 bg-ink-800 py-1 shadow-xl">
              <button
                onClick={handleMute}
                disabled={!meta}
                className={`flex w-full items-center px-4 py-2.5 text-left text-sm ${
                  meta ? "text-zinc-200 hover:bg-white/10" : "cursor-default text-zinc-500"
                }`}
              >
                {meta?.conversation.muted
                  ? "Unmute notifications"
                  : "Mute notifications"}
              </button>
              <button
                onClick={handleBlock}
                disabled={!meta}
                className={`flex w-full items-center px-4 py-2.5 text-left text-sm ${
                  meta ? "text-red-400 hover:bg-white/10" : "cursor-default text-zinc-500"
                }`}
              >
                Block user
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <main
      className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden"
      style={visualHeight !== null ? { height: `${visualHeight}px` } : undefined}
    >
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-ink-900/95 px-4 backdrop-blur">
        <Link
          href="/chat"
          className="mr-1 text-zinc-400 hover:text-zinc-200"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>

        {celebrity ? (
          <>
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">
              {celebrity.profileImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={celebrity.profileImage}
                  alt={celebrity.name}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-semibold text-zinc-100">
                  {celebrity.name}
                </span>
                {celebrity.isVerified && <VerifiedBadge />}
              </div>
              <p className="text-xs text-zinc-400">
                {celebrity.chatAccountLabel ??
                  (otherTyping ? (
                    <span className="text-primary-400">typing…</span>
                  ) : online ? (
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      online
                    </span>
                  ) : (
                    "offline"
                  ))}
              </p>
            </div>
            {headerControls}
          </>
        ) : (
          <>
            <div className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-white/10" />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-zinc-100">
                {metaStatus === "unavailable" ? "Conversation unavailable" : "Chat"}
              </span>
              <span className="text-xs text-zinc-400">
                {metaStatus === "unavailable"
                  ? "This conversation is no longer available"
                  : !isOnline
                    ? "You're offline — reconnecting…"
                    : metaTransient
                      ? "Reconnecting…"
                      : ""}
              </span>
            </div>
            {headerControls}
          </>
        )}
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6"
      >
        <div className="mx-auto flex flex-col">
          {metaStatus === "unavailable" && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-zinc-200">Conversation unavailable</p>
              <p className="mt-1 text-sm text-zinc-500">
                This conversation doesn&apos;t exist or is no longer accessible.
              </p>
              <Link
                href="/chat"
                className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-primary-400 transition-colors hover:bg-white/10"
              >
                Back to chat
              </Link>
            </div>
          )}

          {metaStatus !== "unavailable" && (
            <>
              <div className="flex flex-col gap-2">
                {!isOnline && (
                  <div className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-ink-800/90 px-3 py-1.5 text-xs text-zinc-300">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    {messages.length > 0
                      ? "You're offline — showing saved messages"
                      : "You're offline — messages will sync when you're back online"}
                  </div>
                )}
                {isOnline && !rtConnected && meta && (
                  <div className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-ink-800/90 px-3 py-1.5 text-xs text-zinc-300">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    Reconnecting…
                  </div>
                )}
                {(metaTransient || messagesFailed) && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-ink-800/90 px-3 py-1.5 text-xs text-zinc-300">
                    <span>Couldn&apos;t refresh — showing what we have.</span>
                    <button
                      onClick={retry}
                      className="shrink-0 text-primary-400 hover:text-primary-300"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {blocked && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                    You blocked this user.
                  </div>
                )}
                {conversation && conversation.status !== "ACTIVE" && (
                  <div className="rounded-lg border border-white/10 bg-ink-800/90 px-3 py-1.5 text-xs text-zinc-400">
                    This conversation is not active.
                  </div>
                )}
              </div>

              {hasMore && (
                <button
                  onClick={loadOlder}
                  disabled={loadingOlder}
                  className="mx-auto mb-4 mt-3 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200 disabled:opacity-50"
                >
                  {loadingOlder ? "Loading..." : "Load earlier messages"}
                </button>
              )}

              {groupedMessages.map(({ msg, isFirstInGroup, isLastInGroup }) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.senderType === "fan"}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  onMediaClick={(attachment) => setLightboxAttachment(attachment)}
                />
              ))}

              {messages.length === 0 && !messagesFailed && (
                <div className="py-16 text-center text-sm text-zinc-500">
                  No messages yet — say hello!
                </div>
              )}

              <div ref={bottomRef} className="h-px" />
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <Composer
          onSendText={sendText}
          onSendImage={sendImage}
          onSendVoice={sendVoice}
          onTyping={sendTyping}
          disabled={isDisabled || metaStatus === "unavailable"}
          unavailable={metaStatus === "unavailable"}
        />
      </div>

      {lightboxAttachment && (
        <AttachmentLightbox
          attachment={lightboxAttachment}
          onClose={() => setLightboxAttachment(null)}
        />
      )}

      <CallOverlay
        key={callSession}
        conversationId={conversationId}
        open={callOpen}
        mode={callMode}
        contactName={celebrity?.name ?? ""}
        contactAvatar={celebrity?.profileImage ?? null}
        onClose={() => setCallOpen(false)}
      />

      {premiumGate && celebrity && (
        <div className="fixed inset-0 z-[65] grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md">
            <LockedPremium
              feature={premiumGate}
              name={celebrity.name}
              onGetCard={() => {
                setPremiumGate(null);
                router.push(`/celebrity/${celebrity.slug}?focus=fan-card`);
              }}
            />
            <div className="mt-3 text-center">
              <button
                onClick={() => setPremiumGate(null)}
                className="text-sm text-zinc-400 hover:text-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
