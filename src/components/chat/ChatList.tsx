"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FanConversationView } from "@/lib/chat/list";

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function previewText(c: FanConversationView): string {
  const prefix = c.lastMessageSender === "fan" ? "You: " : "";
  const raw = c.lastMessagePreview ?? c.lastMessage?.body ?? "Tap to start chatting";
  if (!raw) return prefix + "Tap to start chatting";
  const media =
    c.lastMessage?.type === "image"
      ? "[Photo]"
      : c.lastMessage?.type === "voice"
        ? "[Voice note]"
        : c.lastMessage?.type === "video"
          ? "[Video]"
          : c.lastMessage?.type === "call"
            ? "[Call]"
            : raw;
  return prefix + media;
}

export default function ChatList({
  initialConversations = [],
}: {
  initialConversations?: FanConversationView[];
}) {
  const [conversations, setConversations] = useState<FanConversationView[]>(initialConversations);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/chat/conversations");
        if (!res.ok) throw new Error("Failed to load conversations");
        const data = await res.json();
        if (!cancelled) {
          setConversations(data.conversations ?? []);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not load your conversations. Please try again.");
      }
    };
    const timer = window.setInterval(() => {
      load();
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const filtered = conversations
    .filter((c) =>
      c.celebrity.name.toLowerCase().includes(search.trim().toLowerCase())
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0) -
          (a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0)
    );

  return (
    <div>
      <div className="relative mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pl-11 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500"
        />
        <svg
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
      </div>

      <div className="space-y-1.5">
        {error ? (
          <div className="glass rounded-2xl px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl px-6 py-14 text-center">
            <p className="text-lg font-semibold text-zinc-200">
              {search ? "No results" : "No messages yet"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
              {search
                ? "Try a different search."
                : "Find your favorite celebrity and start chatting — it's free."}
            </p>
            {!search && (
              <Link
                href="/celebrities"
                className="btn-grad mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-bold text-white"
              >
                Browse celebrities
              </Link>
            )}
          </div>
        ) : (
          filtered.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-white/5"
            >
              <div className="relative shrink-0">
                <div className="grid h-12 w-12 overflow-hidden rounded-full bg-gradient-to-br from-primary-600 to-accent-500 ring-1 ring-white/10">
                  {c.celebrity.profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.celebrity.profileImage}
                      alt={c.celebrity.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-sm font-bold text-white">
                      {c.celebrity.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {c.celebrity.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-ink-900" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`truncate text-sm ${
                      c.unread > 0 ? "font-bold text-white" : "font-medium text-zinc-200"
                    }`}
                  >
                    {c.celebrity.name}
                  </p>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatWhen(c.lastMessageAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p
                    className={`truncate text-xs ${
                      c.unread > 0 ? "text-zinc-300" : "text-zinc-500"
                    }`}
                  >
                    {previewText(c)}
                  </p>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {c.pinned && <span className="text-xs text-gold-400" title="Pinned">📌</span>}
                    {c.muted && <span className="text-xs text-zinc-500" title="Muted">🔕</span>}
                    {c.unread > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary-500 px-1.5 text-[11px] font-bold text-white">
                        {c.unread > 99 ? "99+" : c.unread}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}