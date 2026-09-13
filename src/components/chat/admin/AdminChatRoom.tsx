"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MessageBubble from "@/components/chat/MessageBubble";
import AdminCallOverlay from "@/components/chat/admin/AdminCallOverlay";
import type { RealtimeMessage } from "@/hooks/useChatRealtime";

const AI_STYLE_PRESETS = [
  "Friendly and warm",
  "Playful and fun",
  "Professional and polished",
  "Inspiring and motivational",
  "Focused on music/art/sport",
  "Quiet and sincere",
] as const;

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3l2.1 5.4L19.5 10.5l-5.4 2.1L12 18l-2.1-5.4-5.4-2.1 5.4-2.1L12 3z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" opacity=".7" />
    </svg>
  );
}

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
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const router = useRouter();

  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [aiStyle, setAiStyle] = useState<string>("Friendly and warm");
  const styleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadAiStyle = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/ai/style?conversationId=${encodeURIComponent(conversationId)}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { style?: string | null };
      if (data.style) setAiStyle(data.style);
    } catch {
      /* keep default style */
    }
  }, [conversationId, router]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadAiStyle();
    }, 0);
    return () => {
      window.clearTimeout(t);
      if (styleTimer.current) clearTimeout(styleTimer.current);
    };
  }, [loadAiStyle]);

  const persistAiStyle = useCallback(
    (style: string) => {
      if (styleTimer.current) clearTimeout(styleTimer.current);
      styleTimer.current = setTimeout(() => {
        void fetch(`/api/chat/ai/style`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, style }),
        }).catch(() => {
          /* best effort */
        });
      }, 400);
    },
    [conversationId],
  );

  const onStyleChange = (value: string) => {
    setAiStyle(value);
    persistAiStyle(value);
  };

  const suggestReply = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    setAiText(null);
    try {
      const res = await fetch(`/api/chat/ai/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not generate a reply.");
      }
      const data = (await res.json()) as {
        text: string;
        configured?: boolean;
      };
      setAiText(data.text);
      setAiConfigured(data.configured ?? true);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Could not generate a reply.");
    } finally {
      setAiLoading(false);
    }
  }, [conversationId, router]);

  const applySuggestion = (keepOpen: boolean) => {
    if (!aiText) return;
    setInput(aiText);
    setAiText(null);
    if (!keepOpen) setAiOpen(false);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  };

  const toggleAi = () => {
    const next = !aiOpen;
    setAiOpen(next);
    if (next && messages.some((m) => m.senderType === "fan")) {
      void suggestReply();
    }
  };

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

      {/* Reply assistant */}
      {aiOpen && (
        <div className="border-t border-white/10 bg-white/[0.03]">
          <div className="mx-auto flex max-w-2xl flex-col gap-2 px-3 py-2.5">
            {/* header */}
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-primary-300">
                <SparkleIcon className="h-3.5 w-3.5" />
                Assistant
              </p>
              <button
                type="button"
                onClick={() => setAiOpen(false)}
                aria-label="Close reply assistant"
                className="grid h-6 w-6 place-items-center rounded-full text-zinc-500 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* style selector */}
            <div className="flex items-center gap-2">
              <input
                value={aiStyle}
                onChange={(e) => onStyleChange(e.target.value)}
                list="ai-style-presets"
                placeholder="Reply style…"
                aria-label="Reply style"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-primary-500"
              />
              <datalist id="ai-style-presets">
                {AI_STYLE_PRESETS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <span className="shrink-0 text-[10px] text-zinc-600">style</span>
            </div>

            {aiLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                <svg className="h-4 w-4 animate-spin text-primary-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <p className="text-sm text-zinc-300">Thinking of a reply…</p>
              </div>
            ) : aiError ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5">
                <p className="text-sm text-rose-300">{aiError}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void suggestReply()}
                    className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs font-bold text-rose-200 ring-1 ring-rose-500/30 transition hover:bg-rose-500/30"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiError(null)}
                    className="rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : aiText ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-primary-500/30 bg-primary-500/10 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-primary-300">Draft reply</p>
                <p className="text-sm leading-relaxed text-white">{aiText}</p>
                {!aiConfigured && (
                  <p className="text-[11px] leading-snug text-zinc-500">
                    Live drafting isn&apos;t active yet — this is a saved draft. Add the assistant key (
                    <span className="font-mono text-zinc-400">ASSIST_GEMINI_KEY</span>) to enable it.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applySuggestion(true)}
                    className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-500"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => applySuggestion(false)}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/20"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void suggestReply()}
                    disabled={aiLoading}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiText(null)}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">Ask the assistant to draft a reply to {fan.name}&apos;s latest message.</p>
                <button
                  type="button"
                  onClick={() => void suggestReply()}
                  disabled={aiLoading}
                  className="flex items-center gap-1 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-500 disabled:opacity-40"
                >
                  <SparkleIcon className="h-3.5 w-3.5" />
                  Suggest reply
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={toggleAi}
          aria-label={aiOpen ? "Close reply assistant" : "Open reply assistant"}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border transition ${
            aiOpen
              ? "border-primary-500/50 bg-primary-500/20 text-primary-300"
              : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
          }`}
        >
          <SparkleIcon className="h-5 w-5" />
        </button>
        <textarea
          ref={composerRef}
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

      <AdminCallOverlay
        conversationId={conversationId}
        fanName={fan.name}
        onClosed={() => {}}
      />
    </div>
  );
}