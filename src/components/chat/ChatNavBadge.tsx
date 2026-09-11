"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function ChatNavBadge({
  variant,
  onNavigate,
}: {
  variant: "nav" | "menu";
  onNavigate?: () => void;
}) {
  const [unread, setUnread] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/unread", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { unread?: number };
        setUnread(Math.max(0, Math.round(data.unread ?? 0)));
      } else if (res.status === 401) {
        setUnread(0);
      }
    } catch {
      /* polling must never crash the header */
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 60_000);
    const first = window.setTimeout(() => {
      void refresh();
    }, 0);
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  // Refresh again after navigating back to a chat screen — the server response
  // corrects any stale value within a minute regardless.
  useEffect(() => {
    if (pathname !== "/chat" && !pathname.startsWith("/chat/")) return;
    const t = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(t);
  }, [pathname, refresh]);

  const active = pathname === "/chat" || pathname.startsWith("/chat/");

  if (variant === "menu") {
    return (
      <Link
        href="/chat"
        onClick={() => {
          onNavigate?.();
          router.refresh();
        }}
        className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5 hover:text-white"
      >
        <span>Messages</span>
        {unread > 0 && (
          <span className="grid min-w-[1.25rem] place-items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      href="/chat"
      className={`relative rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      Messages
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-black leading-none text-white ring-2 ring-ink-900">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}