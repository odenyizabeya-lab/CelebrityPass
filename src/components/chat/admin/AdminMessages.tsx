"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminConversationView } from "@/lib/chat/admin-list";
import VerifiedBadge from "@/components/VerifiedBadge";

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const d = new Date(iso);
  const today = new Date();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

function previewText(m: AdminConversationView["lastMessage"]): string {
  if (!m) return "No messages yet";
  if (m.type === "image") return "[Photo]";
  if (m.type === "voice") return "[Voice note]";
  if (m.type === "video") return "[Video]";
  if (m.type === "call") return "[Call]";
  if (m.type === "system") return "System";
  const body = (m.body ?? "").replace(/\s+/g, " ").trim();
  return body.length > 72 ? `${body.slice(0, 72).trimEnd()}…` : body;
}

function previewLine(
  m: AdminConversationView["lastMessage"],
  lastMessageSender: string | null,
): { text: string; prefix: string; own: boolean } {
  const text = previewText(m);
  if (!m) return { text, prefix: "", own: false };
  if (m.senderType === "team") return { text, prefix: "You: ", own: true };
  if (m.senderType === "system") return { text, prefix: "System: ", own: false };
  return { text, prefix: lastMessageSender === "team" ? "You: " : "", own: false };
}

function initials(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

function AiPill({ aiMode }: { aiMode: string }) {
  const manual = aiMode === "manual";
  return (
    <span
      title={manual ? "AI replies are off for this chat — team only" : "AI may reply automatically"}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
        manual
          ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/25"
          : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
      }`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${manual ? "bg-red-400" : "bg-emerald-400"}`} />
      {manual ? "Manual" : "AI"}
    </span>
  );
}

function ChatPill({ open }: { open: boolean }) {
  return (
    <span
      title={open ? "Chat access is open for fans" : "Chat access is closed for fans"}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
        open
          ? "bg-white/[0.06] text-zinc-300 ring-1 ring-white/10"
          : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25"
      }`}
    >
      {open ? "Chat open" : "Chat closed"}
    </span>
  );
}

export default function AdminMessages({
  initialConversations,
}: {
  initialConversations: AdminConversationView[];
}) {
  const [conversations, setConversations] = useState<AdminConversationView[]>(initialConversations);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(initialConversations.length > 0);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/chat/admin/conversations", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load conversations");
        const data = await res.json();
        if (!cancelled) {
          setConversations(data.conversations ?? []);
          setError(null);
          setLoadedOnce(true);
        }
      } catch {
        if (!cancelled && firstLoadRef.current) {
          setError("Could not refresh conversations.");
        }
      } finally {
        firstLoadRef.current = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const fan = `${c.fan.name} ${c.fan.email} ${c.fan.country ?? ""}`.toLowerCase();
      const celeb = `${c.celebrity.name} ${c.celebrity.profession}`.toLowerCase();
      return fan.includes(q) || celeb.includes(q);
    });
  }, [conversations, query]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-950/50 sm:h-[calc(100dvh-10rem)] lg:h-[calc(100dvh-8rem)]">
      {/* Inbox header */}
      <div className="flex flex-col gap-2 border-b border-white/[0.08] px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black tracking-tight text-white sm:text-lg">Messages</h2>
            {totalUnread > 0 && (
              <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          <span className="shrink-0 text-xs font-medium text-zinc-500">
            {conversations.length} chat{conversations.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fan, email or celebrity…"
            aria-label="Search conversations"
            className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2 pl-9 pr-9 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500/60 focus:bg-white/[0.06]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-[11px] text-zinc-300 transition hover:bg-white/20"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          {error}
        </p>
      )}

      {/* Conversation list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loadedOnce && !error ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-primary-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-white/[0.04] text-2xl">💬</div>
            <p className="mt-3 text-sm font-semibold text-zinc-300">No conversations yet</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
              When fans start chatting with your celebrities, every conversation appears here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <p className="text-sm font-semibold text-zinc-300">No matches for “{query}”</p>
            <p className="mt-1 text-xs text-zinc-500">Try a fan&apos;s name, email, or a celebrity name.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {filtered.map((c) => {
              const { text, prefix, own } = previewLine(c.lastMessage, c.lastMessageSender);
              return (
                <li key={c.id}>
                  <Link
                    href={`/admin/messages/${c.id}`}
                    className={`group flex items-center gap-3 px-3 py-3 transition hover:bg-white/[0.03] sm:px-4 ${
                      c.unread > 0 ? "bg-primary-600/[0.06]" : ""
                    }`}
                  >
                    {/* Avatar stack: celebrity photo + fan initials */}
                    <div className="relative shrink-0">
                      <div
                        className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-black text-white ring-1 ring-white/10"
                        style={{ backgroundColor: c.celebrity.profileImage ? undefined : c.celebrity.accentColor }}
                      >
                        {c.celebrity.profileImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.celebrity.profileImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          c.celebrity.name.slice(0, 1)
                        )}
                      </div>
                      <div
                        className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full text-[9px] font-black text-white ring-2 ring-ink-950"
                        style={{ backgroundColor: c.celebrity.accentColor }}
                        title={c.fan.name}
                      >
                        {initials(c.fan.name)}
                      </div>
                      {c.fan.isOnline && (
                        <span
                          className="absolute -top-0.5 -right-0.5 inline-block h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-ink-950"
                          title="Fan online now"
                        />
                      )}
                    </div>

                    {/* Body */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-bold text-white">
                          {c.fan.name}
                          {!c.fan.isActive && (
                            <span className="ml-2 text-[10px] font-black uppercase text-zinc-500">Inactive</span>
                          )}
                        </p>
                        <span className="shrink-0 text-[11px] text-zinc-500">
                          {relativeTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="flex min-w-0 items-center gap-1 truncate text-xs text-zinc-500">
                          <span className="truncate">{c.celebrity.name}</span>
                          {c.celebrity.isVerified && <VerifiedBadge className="h-3 w-3 shrink-0" />}
                          <span className="text-zinc-700">·</span>
                          <span className="min-w-0 flex-1 truncate">
                            <span className={own ? "text-primary-300" : "text-zinc-400"}>
                              {prefix}
                              {text}
                            </span>
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Status column */}
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <AiPill aiMode={c.aiMode} />
                        <ChatPill open={c.celebrity.chatAccessEnabled} />
                      </div>
                      {c.unread > 0 ? (
                        <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-700">{c.fan.hasPass ? "Pass" : "No pass"}</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}