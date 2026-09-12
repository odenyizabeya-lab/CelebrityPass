"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useChatRealtime } from "@/hooks/useChatRealtime";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import MessageBubble from "./MessageBubble";
import AttachmentLightbox, { type LightboxAttachment } from "./AttachmentLightbox";
import CallOverlay from "./CallOverlay";
import LockedPremium from "./LockedPremium";

interface ConversationMeta {
  id: string;
  celebrityId: string;
  status: string;
  muted: boolean;
  pinned: boolean;
}

interface Celebrity {
  id: string;
  slug: string;
  name: string;
  profession: string;
  profileImage: string;
  isVerified: boolean;
  chatAccountType: string;
  chatAccountLabel: string | null;
  online: boolean;
}

interface ReadState {
  fanLastReadAt: string | null;
  teamLastReadAt: string | null;
}

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

const EMOJIS = [
  "😀","😄","😁","😂","🤣","😊","😍","🥰","😘","😎",
  "🤩","🥳","🙂","😉","😢","😭","😡","🥺","😴","🤔",
  "👍","👎","👏","🙏","💪","🤝","👋","✌️","🤞","❤️",
  "💔","💯","🔥","✨","🎉","🎊","🥂","🍕","🍔","☕",
  "🏆","⚽","🎵","🎶","🌹","🌞","😈","👀","💎","💰",
  "📸","🎁","⭐","🌈","😇","🥶","🤯","🫡","🙌","🤲",
];

interface ComposerProps {
  onSendText: (text: string) => void;
  onSendImage: (file: File, caption: string) => void;
  onSendVoice: (blob: Blob) => void;
  onTyping: () => void;
  disabled: boolean;
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

function Composer({ onSendText, onSendImage, onSendVoice, onTyping, disabled }: ComposerProps) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
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
      setEmojiOpen(false);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText("");
    setEmojiOpen(false);
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
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
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
          <div className="flex items-center gap-1.5">
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
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200 disabled:opacity-40"
              title="Attach photo"
              aria-label="Attach photo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />

            <button
              onClick={() => setEmojiOpen((v) => !v)}
              disabled={disabled}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200 disabled:opacity-40"
              title="Emoji"
              aria-label="Emoji"
            >
              🙂
            </button>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              disabled={disabled}
              placeholder={disabled ? "Chat unavailable" : "Message..."}
              rows={1}
              className="max-h-[120px] min-h-[48px] flex-1 resize-none rounded-xl bg-white/10 px-3.5 py-2.5 text-sm leading-6 text-zinc-200 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            />

            <button
              onClick={handleSend}
              disabled={disabled || (!text.trim() && !pendingImage)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-500 disabled:opacity-40"
              title="Send"
              aria-label="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>

            <button
              onClick={() => void startRecording()}
              disabled={disabled}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200 disabled:opacity-40"
              title="Record voice note"
              aria-label="Record voice note"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          </div>
        )}

        {emojiOpen && (
          <div className="absolute bottom-full left-0 right-0 z-40 mx-auto mb-1 grid max-w-3xl grid-cols-10 gap-0.5 rounded-xl border border-white/10 bg-ink-800 p-2 shadow-xl">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  setText((prev) => prev + e);
                  textareaRef.current?.focus();
                  onTyping();
                }}
                className="grid h-8 w-full place-items-center rounded-md text-lg transition hover:bg-white/10"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VerifiedBadge() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="#3b82f6"
      className="ml-0.5 inline-block shrink-0"
    >
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function ChatRoom({ conversationId }: { conversationId: string }) {
  const [meta, setMeta] = useState<{
    conversation: ConversationMeta;
    celebrity: Celebrity;
    readState: ReadState;
  } | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [isStuckToBottom, setIsStuckToBottom] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const { state: pushState, enable: enablePush, disable: disablePush } = usePushNotifications();
  const router = useRouter();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [since, setSince] = useState<string | null>(null);

  // Tracks the visual viewport height so the composer stays pinned above the
  // Android keyboard while it is open and returns to the bottom when closed.
  const [visualHeight, setVisualHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVisualHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      vv.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/${conversationId}`);
        if (res.status === 404 || res.status === 403) {
          if (!cancelled) setError("unavailable");
          return;
        }
        if (!res.ok) throw new Error("Failed to load conversation");
        const data = await res.json();
        if (!cancelled) {
          setMeta(data);
          setOnline(data.celebrity?.online ?? false);
          setPremiumUnlocked(data.premium?.unlocked ?? true);
        }
      } catch {
        if (!cancelled) setError("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/chat/${conversationId}/messages?limit=50`
        );
        if (!res.ok) throw new Error("Failed to load messages");
        const data = await res.json();
        if (!cancelled) {
          setMessages(data.messages ?? []);
          setHasMore(data.hasMore ?? false);
          const latest = data.messages?.[data.messages.length - 1];
          if (latest?.createdAt) setSince(latest.createdAt);
        }
      } catch {
        if (!cancelled) setError("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meta, conversationId]);

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

  useChatRealtime(conversationId, since, {
    onMessage: (message: import("@/hooks/useChatRealtime").RealtimeMessage) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id)
          ? prev
          : [...prev, { ...message, repliedTo: message.repliedTo ?? null } as Msg]
      );
      setSince(message.createdAt);
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
      const older: Msg[] = data.messages ?? [];
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
      if (!res.ok) throw new Error("Send failed");
      const serverMsg: Msg = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.clientId === clientId ? serverMsg : m))
      );
    } catch {
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
      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          type,
          body,
          attachmentJson: JSON.stringify(upload.attachment),
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      const serverMsg: Msg = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.clientId === clientId ? serverMsg : m))
      );
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

  if (error === "unavailable") {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
        <p className="text-zinc-400">Conversation unavailable</p>
        <Link
          href="/chat"
          className="mt-3 text-sm text-primary-400 hover:text-primary-300"
        >
          Back to chat
        </Link>
      </main>
    );
  }

  const celebrity = meta?.celebrity;
  const conversation = meta?.conversation;
  const isDisabled =
    !conversation || conversation.status !== "ACTIVE" || blocked;

  const startCall = (mode: "voice" | "video") => {
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

        {celebrity && (
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
                        className="flex w-full items-center px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-white/10"
                      >
                        {meta?.conversation.muted
                          ? "Unmute notifications"
                          : "Mute notifications"}
                      </button>
                      <button
                        onClick={handleBlock}
                        className="flex w-full items-center px-4 py-2.5 text-left text-sm text-red-400 hover:bg-white/10"
                      >
                        Block user
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6"
      >
        <div className="mx-auto flex flex-col">
          {hasMore && (
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="mx-auto mb-4 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200 disabled:opacity-50"
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

          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      {celebrity && (
        <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">
          <Composer
            onSendText={sendText}
            onSendImage={sendImage}
            onSendVoice={sendVoice}
            onTyping={sendTyping}
            disabled={isDisabled}
          />
        </div>
      )}

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
