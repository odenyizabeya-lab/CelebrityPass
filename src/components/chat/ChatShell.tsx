"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FanConversationView } from "@/lib/chat/list";
import {
  readConversationListCache,
  writeConversationListCache,
} from "@/lib/chat/local-cache";
import ChatList from "./ChatList";

/**
 * Full Messages screen shell. Opens INSTANTLY: the previously cached list is
 * hydrated from localStorage before first paint (identical to how ChatRoom
 * opens rooms), so returning to Messages never shows a loading screen. Fresh
 * data is fetched in the background and reconciles silently, then replaces the
 * cache. A loading hint only appears when there is genuinely no data yet
 * (first-ever visit) — never while cached conversations are already visible.
 */
const POLL_MS = 30_000;

export default function ChatShell() {
  const [conversations, setConversations] = useState<FanConversationView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const inflightRef = useRef(false);
  const router = useRouter();

  // INSTANT OPEN — paint the cached list before the browser draws the first
  // frame. Missing/corrupt cache just starts empty and the fetch below fills it.
  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const cached = readConversationListCache();
    if (cached.length > 0) setConversations(cached);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const refresh = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const res = await fetch("/api/chat/conversations", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (res.status === 401) {
        router.replace("/login?next=/chat");
        return;
      }
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = (await res.json()) as { conversations?: FanConversationView[] };
      const list = data.conversations ?? [];
      // Update the cache so the NEXT visit (even offline/4G) opens instantly.
      writeConversationListCache(list);
      setConversations(list);
      setError(null);
    } catch {
      // Silent refresh: when cached conversations are already on screen, keep
      // showing them — the next poll retries. Only surfaces when there's no data.
      setError("Could not load your conversations. Please try again.");
    } finally {
      inflightRef.current = false;
      setPending(false);
    }
  }, [router]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    let timer: number | null = null;
    const visible = () => document.visibilityState === "visible";
    const startTimer = () => {
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(() => {
        if (visible()) void refresh();
      }, POLL_MS);
    };
    const onComeBack = () => {
      if (visible()) {
        // Returning to the app/tab: refresh right away so the list is current.
        void refresh();
        startTimer();
      }
    };

    void refresh();
    startTimer();
    document.addEventListener("visibilitychange", onComeBack);
    window.addEventListener("focus", onComeBack);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onComeBack);
      window.removeEventListener("focus", onComeBack);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh]);

  const unreadCount = conversations.reduce((acc, c) => acc + (c.unread || 0), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-ink-900/95 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            aria-label="Back to home"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:text-white"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-bold text-white">
            Messages
            {unreadCount > 0 && (
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary-500 px-2 text-xs font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </h1>
        </div>
        <Link
          href="/celebrities"
          className="btn-grad rounded-full px-4 py-2 text-sm font-bold text-white"
        >
          New
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <ChatList
          conversations={conversations}
          loading={pending && conversations.length === 0}
          error={error}
          onRetry={refresh}
        />
      </div>
    </div>
  );
}