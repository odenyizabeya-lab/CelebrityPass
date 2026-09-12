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
        <ChatList initialConversations={conversations} />
      </div>
    </div>
  );
}