"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MessageBubble from "@/components/chat/MessageBubble";
import AdminCallOverlay from "@/components/chat/admin/AdminCallOverlay";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useChatRealtime, type RealtimeMessage } from "@/hooks/useChatRealtime";

/** Server-page seed — lets the header paint instantly; the room then refreshes. */
export interface AdminChatRoomSeedCelebrity {
  slug: string;
  name: string;
  profession: string;
  accentColor: string;
  profileImage: string | null;
  chatAccountLabel: string | null;
  isVerified: boolean;
}
export interface AdminChatRoomSeedFan {
  name: string;
  email: string;
  country: string | null;
}

interface RoomDetail {
  conversation: {
    id: string;
    status: string;
    aiMode: "auto" | "manual";
    lastMessageAt: string | null;
  };
  fan: {
    id: string;
    name: string;
    email: string;
    country: string | null;
    isActive: boolean;
    isOnline: boolean;
    lastSeenAt: string | null;
    hasPass: boolean;
  };
  celebrity: {
    id: string;
    slug: string;
    name: string;
    profession: string;
    accentColor: string;
    profileImage: string | null;
    isVerified: boolean;
    chatAccountType: string;
    chatAccountLabel: string | null;
    isOnline: boolean;
    chatAccessEnabled: boolean;
    chatAccessOffMessage: string;
  };
  readState: { fanLastReadAt: string | null; teamLastReadAt: string | null };
}

const AI_STYLE_PRESETS = [
  "Romantic and affectionate",
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
    const a = JSON.parse(m.attachmentJson) as { url?: string; mime?: string };
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

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function TypingIndicator() {
  return (
    <div className="mt-[2px] flex justify-start px-3 sm:px-5">
      <div className="self-end rounded-2xl rounded-bl-lg bg-[#202c33] px-4 py-3.5">
        <span className="flex items-center gap-1.5">
          <span className="typing-dot h-2 w-2 rounded-full bg-[#8696a0]" />
          <span className="typing-dot h-2 w-2 rounded-full bg-[#8696a0]" />
          <span className="typing-dot h-2 w-2 rounded-full bg-[#8696a0]" />
        </span>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-[#1f2c33] px-3.5 py-1 text-xs font-medium text-[#8696a0] shadow-sm">
        {label}
      </span>
    </div>
  );
}

export default function AdminChatRoom({
  conversationId,
  celebrity: seedCelebrity,
  fan: seedFan,
}: {
  conversationId: string;
  celebrity: AdminChatRoomSeedCelebrity;
  fan: AdminChatRoomSeedFan;
}) {
  const router = useRouter();

  // Live room info (status, aiMode, chat access, online state, read state).
  const [info, setInfo] = useState<RoomDetail | null>(null);
  const [detailError, setDetailError] = useState(false);

  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [since, setSince] = useState<string | null>(null);
  const [fanReadAt, setFanReadAt] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fanTyping, setFanTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [nearBottom, setNearBottom] = useState(true);

  // AI assistant panel.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [aiStyle, setAiStyle] = useState<string>("Friendly and warm");
  const styleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat-access message editor.
  const [accessMsgDraft, setAccessMsgDraft] = useState("");
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingAiMode, setSavingAiMode] = useState(false);

  const celebrity = info?.celebrity;
  const fan = info?.fan;
  const celebrityId = celebrity?.id ?? seedCelebrity.slug;
  const chatAccessEnabled = celebrity?.chatAccessEnabled ?? true;

  const applyMessages = useCallback((incoming: RealtimeMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (fresh.length === 0) return prev;
      return [...prev, ...fresh].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
  }, []);

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

  const loadDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/admin/conversations/${conversationId}`, { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = (await res.json()) as RoomDetail;
      setInfo(data);
      setDetailError(false);
      if (typeof data.readState?.fanLastReadAt === "string") {
        setFanReadAt(data.readState.fanLastReadAt);
      }
      setAccessMsgDraft(data.celebrity.chatAccessOffMessage);
    } catch {
      setDetailError(true);
    }
  }, [conversationId, router]);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/${conversationId}/messages?limit=200`, { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load messages");
      const data = (await res.json()) as {
        messages?: RealtimeMessage[];
        hasMore?: boolean;
        readState?: { fanLastReadAt?: string | null; teamLastReadAt?: string | null };
      };
      applyMessages(data.messages ?? []);
      if (data.hasMore !== undefined) setHasMore(data.hasMore);
      const list = data.messages ?? [];
      const last = list[list.length - 1];
      if (last?.createdAt) setSince((prev) => (prev && prev > last.createdAt ? prev : last.createdAt));
      if (data.readState && typeof data.readState.fanLastReadAt === "string") {
        setFanReadAt(data.readState.fanLastReadAt);
      }
      setError(null);
    } catch {
      setError("Could not load messages.");
    }
  }, [conversationId, applyMessages, router]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest?.id) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/chat/${conversationId}/messages?limit=50&cursor=${encodeURIComponent(oldest.id)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { messages?: RealtimeMessage[]; hasMore?: boolean };
      setHasMore(Boolean(data.hasMore));
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const older = (data.messages ?? []).filter((m) => !ids.has(m.id));
        return [...older, ...prev];
      });
    } catch {
      setError("Could not load earlier messages.");
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, messages, loadingOlder]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadDetail();
      void loadRecent();
    }, 0);
    const id = window.setInterval(() => {
      void loadDetail();
      void loadRecent();
    }, 20_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadDetail();
        void loadRecent();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, [loadDetail, loadRecent]);

  // Mark read whenever team-visible content exists (clears the unread badge).
  useEffect(() => {
    if (messages.length === 0) return;
    const t = window.setTimeout(() => void markRead(), 0);
    return () => window.clearTimeout(t);
  }, [messages, markRead]);

  // Realtime — new fan messages appear instantly (no polling wait).
  useChatRealtime(conversationId, since, {
    onMessage: (message: RealtimeMessage) => {
      setError(null);
      applyMessages([message]);
      if (message.senderType === "fan") void markRead();
    },
    onTyping: (event) => {
      if (event.senderType !== "fan") return;
      setFanTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setFanTyping(false), 3000);
    },
    onRead: (event) => {
      if (event.readerType !== "fan" || !event.readAt) return;
      if (!fanReadAt || event.readAt > fanReadAt) setFanReadAt(event.readAt);
    },
    onAuthExpired: () => router.replace("/admin/login"),
  });

  // Fan read watermark: a team message the fan has seen flips to blue ticks.
  useEffect(() => {
    if (!fanReadAt) return;
    const t = new Date(fanReadAt).getTime();
    if (!isFinite(t)) return;
    const raf = requestAnimationFrame(() => {
      setMessages((prev) => {
        let changed = false;
        const next = prev.map((m) => {
          if (m.senderType !== "team" || m.readAt) return m;
          const ct = new Date(m.createdAt).getTime();
          if (!isFinite(ct) || ct > t) return m;
          changed = true;
          return { ...m, readAt: fanReadAt };
        });
        return changed ? next : prev;
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [fanReadAt]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const d = el.scrollHeight - el.scrollTop - el.clientHeight;
      setNearBottom(d < 140);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (nearBottom && bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: "end" });
    }
  }, [messages, fanTyping, nearBottom]);

  // ---- sending ----
  const postMessage = useCallback(
    async (payload: { clientId: string; type: string; body: string; attachmentJson?: string | null }) => {
      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        throw new Error("Unauthorized");
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to send message.");
      }
      const data = (await res.json()) as { message: RealtimeMessage };
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== `pending-${payload.clientId}`);
        const seen = new Set(filtered.map((m) => m.id));
        if (seen.has(data.message.id)) return filtered;
        return [...filtered, data.message].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      return data.message;
    },
    [conversationId, router],
  );

  const sendText = async () => {
    const body = input.trim();
    if (!body || sending) return;
    await sendCore({ clientId: newClientId(), type: "text", body }, body);
    setInput("");
  };

  const sendCore = useCallback(
    async (
      optimistic: Pick<RealtimeMessage, "clientId" | "type" | "body"> & { attachmentJson?: string | null },
      bodyForPlaceholder: string,
    ) => {
      const clientId = optimistic.clientId;
      setSending(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `pending-${clientId}`,
          conversationId,
          senderType: "team",
          fanId: null,
          teamEmail: null,
          clientId,
          type: optimistic.type,
          body: optimistic.body,
          attachmentJson: optimistic.attachmentJson ?? null,
          status: "PENDING",
          deliveredAt: null,
          readAt: null,
          repliedToId: null,
          repliedTo: null,
          editedAt: null,
          deletedAt: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      try {
        await postMessage({
          clientId,
          type: optimistic.type,
          body: bodyForPlaceholder,
          attachmentJson: optimistic.attachmentJson,
        });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error. Please try again.");
        setMessages((prev) =>
          prev.map((m) => (m.clientId === clientId ? { ...m, status: "FAILED" } : m)),
        );
      } finally {
        setSending(false);
        }
    },
    [conversationId, postMessage],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image attachments are supported in this room.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch(`/api/chat/${conversationId}/attachments`, {
        method: "POST",
        body: fd,
      });
      if (up.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!up.ok) {
        const data = (await up.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Upload failed");
      }
      const data = (await up.json()) as { attachment: Record<string, unknown> };
      await sendCore(
        {
          clientId: newClientId(),
          type: "image",
          body: "",
          attachmentJson: JSON.stringify(data.attachment),
        },
        "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image.");
    }
  };

  const retryMessage = useCallback(
    (message: RealtimeMessage) => {
      if (message.type !== "text") return;
      const clientId = message.clientId || newClientId();
      setMessages((prev) => prev.filter((m) => m.id !== message.id && m.clientId !== message.clientId));
      void sendCore({ clientId, type: "text", body: message.body }, message.body);
    },
    [sendCore],
  );

  const deleteLocal = useCallback((message: RealtimeMessage) => {
    setMessages((prev) => prev.filter((m) => m.id !== message.id && m.clientId !== message.clientId));
  }, []);

  // ---- AI replies (per-conversation mode) ----
  const setAiMode = useCallback(
    async (mode: "auto" | "manual") => {
      setSavingAiMode(true);
      setError(null);
      try {
        const res = await fetch(`/api/chat/admin/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aiMode: mode }),
        });
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (!res.ok) throw new Error("Could not update AI mode");
        setInfo((prev) => (prev ? { ...prev, conversation: { ...prev.conversation, aiMode: mode } } : prev));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update AI mode.");
      } finally {
        setSavingAiMode(false);
      }
    },
    [conversationId, router],
  );

  // ---- Chat access (per celebrity) ----
  const setChatAccess = useCallback(
    async (enabled: boolean) => {
      setError(null);
      try {
        const res = await fetch(`/api/chat/admin/celebrities/${encodeURIComponent(celebrityId)}/chat-access`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatAccessEnabled: enabled }),
        });
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (!res.ok) throw new Error("Could not update chat access");
        const data = (await res.json()) as { chatAccessEnabled: boolean; chatAccessOffMessage: string };
        setInfo((prev) =>
          prev
            ? { ...prev, celebrity: { ...prev.celebrity, chatAccessEnabled: data.chatAccessEnabled, chatAccessOffMessage: data.chatAccessOffMessage } }
            : prev,
        );
        setAccessMsgDraft(data.chatAccessOffMessage);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update chat access.");
      }
    },
    [celebrityId, router],
  );

  const saveAccessMessage = useCallback(async () => {
    const msg = accessMsgDraft.trim();
    if (!msg) return;
    setSavingAccess(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/admin/celebrities/${encodeURIComponent(celebrityId)}/chat-access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatAccessEnabled,
          chatAccessOffMessage: msg,
        }),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not save message");
      }
      const data = (await res.json()) as { chatAccessOffMessage: string };
      setInfo((prev) => (prev ? { ...prev, celebrity: { ...prev.celebrity, chatAccessOffMessage: data.chatAccessOffMessage } } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save message.");
    } finally {
      setSavingAccess(false);
    }
  }, [accessMsgDraft, celebrityId, chatAccessEnabled, router]);

  // ---- AI reply assistant ----
  const loadAiStyle = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/ai/style?conversationId=${encodeURIComponent(conversationId)}`, { cache: "no-store" });
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
    const t = window.setTimeout(() => void loadAiStyle(), 0);
    return () => {
      window.clearTimeout(t);
      if (styleTimer.current) clearTimeout(styleTimer.current);
    };
  }, [loadAiStyle]);

  const persistAiStyle = useCallback(
    (style: string) => {
      if (styleTimer.current) clearTimeout(styleTimer.current);
      styleTimer.current = setTimeout(() => {
        void fetch("/api/chat/ai/style", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, style }),
        }).catch(() => {});
      }, 400);
    },
    [conversationId],
  );

  const suggestReply = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    setAiText(null);
    try {
      const res = await fetch("/api/chat/ai/suggest", {
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
      const data = (await res.json()) as { text: string; configured?: boolean };
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
    if (next && messages.some((m) => m.senderType === "fan")) void suggestReply();
  };

  const cardName = celebrity?.name ?? seedCelebrity.name;
  const cardColor = celebrity?.accentColor ?? seedCelebrity.accentColor;
  const cardImage = celebrity?.profileImage ?? seedCelebrity.profileImage;
  const cardVerified = celebrity?.isVerified ?? seedCelebrity.isVerified;
  const fanName = fan?.name ?? seedFan.name;
  const fanEmail = fan?.email ?? seedFan.email;
  const fanOnline = fan?.isOnline ?? false;
  const fanHasPass = fan?.hasPass ?? false;
  const aiMode = info?.conversation.aiMode ?? "auto";
  const manualMode = aiMode === "manual";

  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0b141a]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.07] bg-[#111b21] px-3 py-2.5 sm:px-4">
        <Link
          href="/admin/messages"
          aria-label="Back to all messages"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5m7-7-7 7 7 7" />
          </svg>
        </Link>

        <div className="relative shrink-0">
          <div
            className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-black text-white ring-1 ring-white/10"
            style={{ backgroundColor: cardImage ? undefined : cardColor }}
          >
            {cardImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cardImage} alt="" className="h-full w-full object-cover" />
            ) : (
              cardName.slice(0, 1)
            )}
          </div>
          {fanOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 inline-block h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#111b21]" title="Fan online now" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-bold text-white">
            <span className="truncate">{fanName}</span>
            {fanOnline ? (
              <span className="text-[11px] font-medium text-emerald-400">online</span>
            ) : (
              <span className="text-[11px] font-medium text-zinc-500">
                {celebrity?.isOnline ? "celebrity online" : "offline"}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-zinc-500">
            <span className="font-semibold text-zinc-300">{cardName}</span>
            {cardVerified && <VerifiedBadge className="ml-1 h-3 w-3 shrink-0" />}
            {fanHasPass ? " · CelebrityPass" : " · no pass"}
            {fanEmail ? ` · ${fanEmail}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`hidden rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide sm:inline-flex ${
              chatAccessEnabled ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
            }`}
          >
            {chatAccessEnabled ? "Chat open" : "Chat closed"}
          </span>
          <a
            href={`/celebrity/${celebrity?.slug ?? seedCelebrity.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-300 ring-1 ring-white/15 transition hover:bg-white/5"
          >
            Profile
          </a>
        </div>
      </div>

      {/* Control strip — AI replies + Chat access */}
      <div className="border-b border-white/[0.07] bg-[#0f1a21] px-3 py-2.5 sm:px-4">
        <div className="flex flex-col gap-2.5">
          {/* AI replies */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${
                  manualMode
                    ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/30"
                    : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                }`}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${manualMode ? "animate-pulse bg-red-400" : "bg-emerald-400"}`} />
                {manualMode ? "Manual mode — AI off" : "AI replies on"}
              </span>
              <span className="hidden text-[11px] text-zinc-500 sm:inline">
                {manualMode ? "Only the team answers this fan." : "AI may reply automatically when fans message."}
              </span>
            </div>
            {manualMode ? (
              <button
                type="button"
                disabled={savingAiMode}
                onClick={() => void setAiMode("auto")}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                <SparkleIcon className="h-3.5 w-3.5" />
                Return to AI
              </button>
            ) : (
              <button
                type="button"
                disabled={savingAiMode}
                onClick={() => void setAiMode("manual")}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3.5 py-1.5 text-xs font-bold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                Take over chat
              </button>
            )}
          </div>

          {/* Chat access */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${
                  chatAccessEnabled
                    ? "bg-white/[0.06] text-zinc-300 ring-1 ring-white/10"
                    : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
                }`}
              >
                {chatAccessEnabled ? "Chat access open" : "Chat access closed"}
              </span>
              {!chatAccessEnabled && (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <input
                    value={accessMsgDraft}
                    onChange={(e) => setAccessMsgDraft(e.target.value)}
                    maxLength={300}
                    placeholder="Message fans see while chat is closed…"
                    aria-label="Chat closed message"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-primary-500/60"
                  />
                  <button
                    type="button"
                    disabled={savingAccess || !accessMsgDraft.trim()}
                    onClick={() => void saveAccessMessage()}
                    className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/15 transition hover:bg-white/20 disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void setChatAccess(!chatAccessEnabled)}
              aria-pressed={chatAccessEnabled}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                chatAccessEnabled ? "bg-emerald-600" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  chatAccessEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              void loadDetail();
              void loadRecent();
            }}
            className="shrink-0 font-bold text-amber-200 underline underline-offset-2 hover:text-white"
          >
            Retry
          </button>
        </div>
      )}
      {detailError && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          Couldn&apos;t refresh room details. Showing the last known state.
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="chat-wall min-h-0 flex-1 overflow-y-auto px-2 py-4 sm:px-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col">
          {hasMore && (
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="mx-auto mb-2 mt-1 flex items-center gap-2 rounded-full border border-[#2e3b42] bg-[#1f2c33] px-5 py-2 text-sm text-[#aebac1] transition-colors hover:bg-[#233138] hover:text-white disabled:opacity-50"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/30" />
              {loadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          )}

          {messages.length === 0 && !detailError && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-2xl text-emerald-400 ring-1 ring-emerald-500/20">
                💬
              </div>
              <p className="text-sm font-semibold text-zinc-200">
                {chatAccessEnabled ? `Chat with ${fanName} starts here` : "Chat is closed for this fan"}
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-zinc-500">
                {manualMode
                  ? "This chat is set to manual — replies you send here are the only ones this fan sees."
                  : chatAccessEnabled
                    ? "Send the first message below, or wait for the fan to say hello."
                    : "No messages yet. Re-opening chat access lets the fan continue this conversation."}
              </p>
            </div>
          )}

          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
            const isFirstInGroup = !prev || prev.senderType !== m.senderType;
            const isLastInGroup = i === messages.length - 1;
            return (
              <div key={m.id}>
                {showDay && <Divider label={dayLabel(m.createdAt)} />}
                <MessageBubble
                  message={m}
                  isOwn={m.senderType === "team"}
                  quoteIdentity={{ viewer: "team", fanName: fanName }}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  onMediaClick={
                    parseAttachment(m)
                      ? () => {
                          const a = parseAttachment(m);
                          if (a && a.type !== "file") window.open(a.url, "_blank", "noopener,noreferrer");
                        }
                      : undefined
                  }
                  onRetrySend={m.status === "FAILED" ? () => retryMessage(m) : undefined}
                  onDeleteLocal={m.status === "FAILED" ? () => deleteLocal(m) : undefined}
                />
              </div>
            );
          })}

          {fanTyping && <TypingIndicator />}
          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      {/* Reply assistant */}
      {aiOpen && (
        <div className="border-t border-white/[0.07] bg-[#111b21]">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-primary-300">
                <SparkleIcon className="h-3.5 w-3.5" /> Assistant
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
            <div className="flex items-center gap-2">
              <input
                value={aiStyle}
                onChange={(e) => {
                  setAiStyle(e.target.value);
                  persistAiStyle(e.target.value);
                }}
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
                <p className="max-h-28 overflow-y-auto text-sm leading-relaxed text-white">{aiText}</p>
                {!aiConfigured && (
                  <p className="text-[11px] leading-snug text-zinc-500">
                    Live drafting isn&apos;t active yet — this is a saved draft. Paste the assistant Gemini key in{" "}
                    <span className="font-mono text-zinc-400">Admin → AI Settings</span> to enable it.
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
                <p className="text-xs text-zinc-500">Ask the assistant to draft a reply to {fanName}&apos;s latest message.</p>
                <button
                  type="button"
                  onClick={() => void suggestReply()}
                  disabled={aiLoading}
                  className="flex items-center gap-1 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-500 disabled:opacity-40"
                >
                  <SparkleIcon className="h-3.5 w-3.5" /> Suggest reply
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-white/[0.07] bg-[#111b21] p-3">
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
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={sending}
          aria-label="Attach image"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 transition hover:text-white disabled:opacity-40"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <textarea
          ref={composerRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendText();
            }
          }}
          rows={1}
          placeholder={`Reply to ${fanName} as the ${cardName} team…`}
          className="max-h-32 min-h-[44px] flex-1 resize-y rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
        />
        <button
          type="button"
          onClick={() => void sendText()}
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
        fanName={fanName}
        onClosed={() => {}}
      />

      {lastMessage ? (
        <span className="sr-only">{lastMessage.id}</span>
      ) : null}
    </div>
  );
}

function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}