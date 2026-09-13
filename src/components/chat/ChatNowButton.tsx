"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  readChatNowSeed,
  writeChatNowSeed,
  writeMetaCache,
  type ChatNowSeed,
} from "@/lib/chat/local-cache";

/** Minimal celebrity snapshot used to seed an instant-open chat room. */
export interface ChatNowCelebrity {
  id: string;
  slug: string;
  name: string;
  profileImage: string;
  isVerified: boolean;
}

const EMPTY_READ_STATE = { fanLastReadAt: null, teamLastReadAt: null };

export default function ChatNowButton({
  celebrityId,
  celebrity,
}: {
  celebrityId: string;
  celebrity?: ChatNowCelebrity | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "blocked" | "error" } | null>(null);

  // Warm the route (and keep the seed fresh) so the most common "Chat Now"
  // click navigates instantly.
  useEffect(() => {
    const seed = readChatNowSeed(celebrityId);
    if (seed?.conversationId) {
      router.prefetch(`/chat/${seed.conversationId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrityId]);

  /**
   * Write everything needed to render the chat room instantly on arrival:
   * the navigation seed (find-or-create shortcut) and the room's meta cache
   * (celebrity name/photo/badge so the header is complete before any network).
   */
  const persistSeed = (conversationId: string) => {
    if (!celebrity?.id) return;
    const seed: ChatNowSeed = {
      conversationId,
      celebrityId: celebrity.id,
      celebritySlug: celebrity.slug,
      celebrityName: celebrity.name,
      profileImage: celebrity.profileImage || "",
      isVerified: Boolean(celebrity.isVerified),
      savedAt: new Date().toISOString(),
    };
    writeChatNowSeed(celebrityId, seed);
    writeMetaCache(conversationId, {
      conversation: {
        id: conversationId,
        celebrityId,
        status: "ACTIVE",
        muted: false,
        pinned: false,
      },
      celebrity: {
        id: celebrity.id,
        slug: celebrity.slug,
        name: celebrity.name,
        profession: "",
        profileImage: celebrity.profileImage || "",
        profileImageUrl: "",
        isVerified: Boolean(celebrity.isVerified),
        chatAccountType: "",
        chatAccountLabel: null,
        online: false,
      },
      readState: EMPTY_READ_STATE,
    });
  };

  const start = async () => {
    if (loading) return;

    // INSTANT PATH — this conversation was opened before, so navigate right
    // away from cache with zero network. Sync happens in the chat room.
    const cached = readChatNowSeed(celebrityId);
    if (cached?.conversationId) {
      if (celebrity) persistSeed(cached.conversationId);
      router.push(`/chat/${cached.conversationId}`);
      // Background reconcile: keep the conversation fresh / touch presence.
      void fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebrityId }),
        cache: "no-store",
      })
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json().catch(() => null)) as {
            conversation?: { id?: string };
          } | null;
          const freshId = data?.conversation?.id;
          if (freshId && freshId !== cached.conversationId && celebrity) {
            persistSeed(freshId);
            router.replace(`/chat/${freshId}`);
          }
        })
        .catch(() => {});
      return;
    }

    // First-ever open: no cached conversation id yet, so this one needs the
    // find-or-create round trip. Afterwards every "Chat Now" is instant.
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
            : { kind: "error" },
        );
        return;
      }
      if (!res.ok) {
        setNotice({ kind: "error" });
        return;
      }
      const data = (await res.json()) as { conversation?: { id?: string } };
      const id = data.conversation?.id;
      if (id) {
        if (celebrity) persistSeed(id);
        router.push(`/chat/${id}`);
      }
    } catch {
      setNotice({ kind: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={start}
        disabled={loading}
        className="inline-flex w-full min-w-0 items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-4 text-sm font-bold text-white shadow-[0_10px_30px_-6px_rgba(16,185,129,0.55)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 sm:px-6 sm:text-base"
      >
        <svg
          className="h-5 w-5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          {/* Solid speech bubble with a centered tail — reads as chat instantly */}
          <path
            d="M20 2.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2.5l3.5 3.1 3.5-3.1H18a2 2 0 0 0 2-2v-11a2 2 0 0 0-2-2Z"
            fill="currentColor"
          />
          {/* Three dots in the button's emerald tone — active-messaging feel */}
          <circle cx="7" cy="9.5" r="1.4" fill="#10b981" />
          <circle cx="12" cy="9.5" r="1.4" fill="#10b981" />
          <circle cx="17" cy="9.5" r="1.4" fill="#10b981" />
        </svg>
        <span className="min-w-0 text-center leading-snug">
          {loading ? "Opening..." : "Chat Now"}
        </span>
      </button>

      {notice?.kind === "blocked" && (
        <p className="mt-3 max-w-sm text-sm font-medium text-zinc-400">
          Messaging is blocked for this celebrity. Contact support if you believe this is a mistake.
        </p>
      )}
      {notice?.kind === "error" && (
        <p className="mt-3 max-w-sm text-sm font-medium text-zinc-400">
          Could not open the chat right now. Please try again in a moment.
        </p>
      )}
    </div>
  );
}