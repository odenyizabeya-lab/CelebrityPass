"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MessageBubble from "@/components/chat/MessageBubble";
import type { RealtimeMessage } from "@/hooks/useChatRealtime";

function parseAttachment(m: RealtimeMessage): {
  type: "image" | "voice" | "video" | "file";
  url: string;
  mime: string;
} | null {
  try {
    if (!m.attachmentJson) return null;
    const a = JSON.parse(m.attachmentJson) as {
      url?: string;
      mime?: string;
      type?: string;
    };
    const url = a.url ?? "";
    const mime = String(a.mime ?? "");
    if (!url) return null;
    if (mime.startsWith("image/")) return { type: "image", url, mime };
    if (mime.startsWith("audio/")) return { type: "voice", url, mime };
    if (mime.startsWith("video/")) return { type: "video", url, mime };
    return { type: "file", url, mime };
  } catch {
    return null;
  }
}

export default function AdminChatRoom({
  conversationId,
  celebrity,
  fan,
}: {
  conversationId: string;
  celebrity: {
    slug: string;
    name: string;
    profession: string;
    accentColor: string;
    profileImage: string | null;
    chatAccountLabel: string | null;
  };
  fan: { name: string; email: string; country: string | null };
}) {
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const router = useRouter();

  const applyMessages = useCallback(
    (incoming: RealtimeMessage[]) => {
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = incoming.filter((m) => !seen.has(m.id));
        if (fresh.length === 0) return prev;
        return [...prev, ...fresh].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/${conversationId}/messages?limit=200`, { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load messages");
      const data = (await res.json()) as { messages: RealtimeMessage[] };
      applyMessages(data.messages ?? []);
      setError(null);
    } catch {
      setError("Could not load messages.");
    }
  }, [conversationId, applyMessages, router]);

  const markRead = useCallback(async () => {
    try {
      await fetch(`/api/chat/${conversationId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderType: "team" }),
      });
    } catch {
      /* best effort */
    }
  }, [conversationId]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void load();
    }, 0);
    const id = window.setInterval(() => {
      void load();
    }, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
        void markRead();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load, markRead]);

  // Mark read whenever team-visible messages exist.
  useEffect(() => {
    if (messages.length === 0) return;
    const t = window.setTimeout(() => {
      void markRead();
    }, 0);
    return () => window.clearTimeout(t);
  }, [messages, markRead]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const d = el.scrollHeight - el.scrollTop - el.clientHeight;
      setNearBottom(d < 120);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (nearBottom && bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: "end" });
    }
  }, [messages, nearBottom]);

  const send = async () => {
    const body = input.trim();
    if (!body || sending) return;
    const clientId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
    setInput("");
    setSending(true);
    const optimistic: RealtimeMessage = {
      id: `pending-${clientId}`,
      conversationId,
      senderType: "team",
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
        body: JSON.stringify({ clientId, body, type: "text" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to send message.");
        setMessages((prev) =>
          prev.map((m) => (m.clientId === clientId ? { ...m, status: "FAILED" } : m)),
        );
        return;
      }
      const data = (await res.json()) as { message: RealtimeMessage };
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== optimistic.id);
        const seen = new Set(filtered.map((m) => m.id));
        if (seen.has(data.message.id)) return filtered;
        return filtered.slice().concat([data.message]).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      setError(null);
    } catch {
      setError("Network error. Please try again.");
      setMessages((prev) =>
        prev.map((m) => (m.clientId === clientId ? { ...m, status: "FAILED" } : m)),
      );
    } finally {
      setSending(false);
    }
  };

  const avatarColor = celebrity.accentColor;

  return (
    <div className="flex h-[calc(100vh-14rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-950/40">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-black text-white"
          style={{ backgroundColor: celebrity.profileImage ? undefined : avatarColor }}
        >
          {celebrity.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={celebrity.profileImage} alt="" className="h-full w-full object-cover" />
          ) : (
            celebrity.name.slice(0, 1)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{celebrity.name}</p>
          <p className="truncate text-xs text-zinc-500">
            {celebrity.chatAccountLabel ?? "Team"} · replying to {fan.name} ({fan.email})
          </p>
        </div>
        <a
          href={`/celebrity/${celebrity.slug}`}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-300 ring-1 ring-white/15 transition hover:bg-white/5"
        >
          Profile
        </a>
      </div>

      {error && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
          {error}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col">
          {messages.length === 0 && (
            <p className="mx-auto mt-10 text-sm text-zinc-500">No messages in this conversation yet.</p>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const isFirstInGroup = !prev || prev.senderType !== m.senderType;
            return (
              <MessageBubble
                key={m.id}
                message={m}
                isOwn={m.senderType === "team"}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={i === messages.length - 1}
                onMediaClick={
                  parseAttachment(m)
                    ? () => {
                        const a = parseAttachment(m);
                        if (a && a.type !== "file") {
                          window.open(a.url, "_blank", "noopener,noreferrer");
                        }
                      }
                    : undefined
                }
              />
            );
          })}
          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-white/10 p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={`Reply to ${fan.name} as the ${celebrity.name} team…`}
          className="max-h-32 min-h-[44px] flex-1 resize-y rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || input.trim().length === 0}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-600 text-white transition hover:bg-primary-500 disabled:opacity-40"
          aria-label="Send message"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.7 2.4L22 12 2.7 21.6l2.5-8.1-5-1.5 5-1.5-2.5-8.1zM6.4 13.5L20.3 12 6.4 10.5 8.4 12l-2 1.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}