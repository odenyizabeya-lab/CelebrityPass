"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useChatRealtime } from "@/hooks/useChatRealtime";
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

interface ComposerProps {
  onSendText: (text: string) => void;
  disabled: boolean;
}

function Composer({ onSendText, disabled }: ComposerProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSendText(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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
  };

  return (
    <div className="border-t border-white/10 bg-ink-900 px-3 py-2">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder={disabled ? "Chat unavailable" : "Message..."}
          rows={1}
          className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-xl bg-white/10 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-500 disabled:opacity-40"
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
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
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
  const router = useRouter();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [since, setSince] = useState<string | null>(null);

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
      <main className="flex h-[calc(100dvh-7rem)] flex-col items-center justify-center px-4">
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
    <main className="mx-auto flex h-[calc(100dvh-7rem)] max-w-3xl flex-col">
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
                  (online ? (
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
        className="flex-1 overflow-y-auto px-4 py-6"
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
            />
          ))}

          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      {celebrity && (
        <Composer
          onSendText={sendText}
          disabled={isDisabled}
        />
      )}

      {lightboxAttachment && (
        <AttachmentLightbox
          attachment={lightboxAttachment}
          onClose={() => setLightboxAttachment(null)}
        />
      )}

      <CallOverlay
        key={callSession}
        open={callOpen}
        mode={callMode}
        contactName={celebrity?.name ?? ""}
        contactAvatar={celebrity?.profileImage ?? null}
        onAccept={() => {}}
        onReject={() => setCallOpen(false)}
        onEnd={() => setCallOpen(false)}
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
