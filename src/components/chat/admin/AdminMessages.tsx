"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminConversationView } from "@/lib/chat/admin-list";

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
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function preview(m: AdminConversationView["lastMessage"]): string {
  if (!m) return "No messages yet";
  if (m.type === "image") return "📷 Photo";
  if (m.type === "voice") return "🎤 Voice message";
  if (m.type === "video") return "🎬 Video";
  if (m.type === "call") return "📞 Call";
  if (m.type === "system") return "System";
  const body = m.body.trim();
  return body.length > 60 ? `${body.slice(0, 60)}…` : body;
}

export default function AdminMessages({
  initialConversations,
}: {
  initialConversations: AdminConversationView[];
}) {
  const [conversations, setConversations] = useState<AdminConversationView[]>(initialConversations);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
        }
      } catch {
        if (!cancelled) setError("Could not refresh conversations.");
      }
    };
    const timer = window.setInterval(() => {
      void load();
    }, 30_000);
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

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
          {totalUnread > 0 && (
            <span className="ml-2 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-300">
              {totalUnread} unread
            </span>
          )}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {conversations.length === 0 ? (
          <div className="glass rounded-3xl px-6 py-14 text-center">
            <p className="text-sm text-zinc-500">No conversations yet.</p>
          </div>
        ) : (
          conversations.map((c) => (
            <Link
              key={c.id}
              href={`/admin/messages/${c.id}`}
              className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                c.unread > 0
                  ? "border-primary-500/40 bg-primary-600/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/10">
                {c.celebrity.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.celebrity.profileImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="grid h-full w-full place-items-center text-sm font-black text-white"
                    style={{ backgroundColor: c.celebrity.accentColor }}
                  >
                    {c.celebrity.name.slice(0, 1)}
                  </div>
                )}
                {c.unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-ink-900">
                    {c.unread > 99 ? "99+" : c.unread}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-white">
                    {c.celebrity.name}
                    <span className="ml-2 text-xs font-medium text-zinc-500">{c.fan.name}</span>
                  </p>
                  <span className="shrink-0 text-[11px] text-zinc-500">
                    {relativeTime(c.lastMessageAt)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-zinc-400">
                  {c.lastMessageSender === "fan" ? (
                    <span className="text-zinc-200">{preview(c.lastMessage)}</span>
                  ) : c.lastMessageSender === "team" ? (
                    <span className="text-primary-300">{preview(c.lastMessage)}</span>
                  ) : (
                    <span className="text-zinc-500">{preview(c.lastMessage)}</span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  {c.fan.email} · {c.fan.country ?? "—"} · {c.status}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  router.push(`/admin/messages/${c.id}`);
                }}
                className="hidden shrink-0 rounded-full px-4 py-2 text-xs font-bold text-white ring-1 ring-white/15 transition hover:bg-white/5 sm:block"
              >
                Open →
              </button>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}