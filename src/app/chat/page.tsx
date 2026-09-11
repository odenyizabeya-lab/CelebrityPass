import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFanId } from "@/lib/auth";
import { listFanConversations } from "@/lib/chat/list";
import ChatList from "@/components/chat/ChatList";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/chat");

  const conversations = await listFanConversations(fanId);
  const unreadCount = conversations.reduce((acc, c) => acc + (c.unread || 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            aria-label="Back to home"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-zinc-300 ring-1 ring-white/10 transition hover:text-white hover:ring-white/25"
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
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-white">
              Messages
              {unreadCount > 0 && (
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary-500 px-2 text-xs font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">Chat with your favorite celebrities</p>
          </div>
        </div>
        <Link
          href="/celebrities"
          className="btn-grad rounded-full px-5 py-2.5 text-sm font-bold text-white"
        >
          New
        </Link>
      </div>

      <ChatList initialConversations={conversations} />
    </div>
  );
}