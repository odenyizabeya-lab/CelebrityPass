"use client";

import { useEffect, useState } from "react";

/** Polls the admin unread count so the Messages badge stays live. */
export default function AdminMessagesBadge({ className }: { className?: string }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/chat/admin/unread", { cache: "no-store" });
        if (res.status === 401) {
          setUnread(0);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { unread: number };
        if (!cancelled) setUnread(data.unread ?? 0);
      } catch {
        /* keep last known count */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (unread <= 0) return null;

  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[11px] font-black leading-none text-white ring-2 ring-ink-950 ${className ?? ""}`}
    >
      {unread > 99 ? "99+" : unread}
    </span>
  );
}