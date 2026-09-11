"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ChatNowButton({
  celebrityId,
  celebritySlug,
}: {
  celebrityId: string;
  celebritySlug: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "card" | "blocked" } | null>(null);

  const start = async () => {
    if (loading) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebrityId }),
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push("/login?next=/chat");
        return;
      }
      if (res.status === 403) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setNotice(
          data?.error?.toLowerCase().includes("blocked")
            ? { kind: "blocked" }
            : { kind: "card" },
        );
        return;
      }
      if (!res.ok) {
        setNotice({ kind: "card" });
        return;
      }
      const data = (await res.json()) as { conversation?: { id?: string } };
      const id = data.conversation?.id;
      if (id) router.push(`/chat/${id}`);
    } catch {
      setNotice({ kind: "card" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={start}
        disabled={loading}
        className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-9 py-4 text-base font-bold text-white shadow-[0_10px_30px_-6px_rgba(16,185,129,0.55)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.42-4.03 8-9 8a9.86 9.86 0 01-4.26-.95L3 20l1.26-3.7A7.96 7.96 0 013 12c0-4.42 4.03-8 9-8s9 3.58 9 8z"
          />
        </svg>
        {loading ? "Opening..." : "Chat Now"}
      </button>

      {notice?.kind === "card" && (
        <div className="mt-3 max-w-sm space-y-2">
          <p className="text-sm font-medium text-amber-300">
            A fan card is required to start chatting with this community.
          </p>
          <Link
            href={`/celebrity/${celebritySlug}/join`}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-300 underline-offset-4 hover:underline"
          >
            Get a fan card to start chatting
            <span aria-hidden>›</span>
          </Link>
        </div>
      )}
      {notice?.kind === "blocked" && (
        <p className="mt-3 max-w-sm text-sm font-medium text-zinc-400">
          Messaging is blocked for this celebrity. Contact support if you believe this is a mistake.
        </p>
      )}
    </div>
  );
}