import { redirect } from "next/navigation";
import { getCurrentFanId } from "@/lib/auth";
import ChatRoom from "@/components/chat/ChatRoom";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const fanId = await getCurrentFanId();

  if (!fanId) {
    redirect(`/login?next=/chat/${conversationId}`);
  }

  return <ChatRoom conversationId={conversationId} />;
}
