import { redirect } from "next/navigation";
import { getCurrentFanId } from "@/lib/auth";
import ChatShell from "@/components/chat/ChatShell";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/chat");

  // The shell renders INSTANTLY: the conversation list is read from the local
  // cache on the client and refreshed silently in the background, so nothing
  // here may block on a database / API round trip.
  return <ChatShell />;
}