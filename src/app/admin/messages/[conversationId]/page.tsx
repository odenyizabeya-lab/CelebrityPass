import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import AdminChatRoom from "@/components/chat/admin/AdminChatRoom";

export const dynamic = "force-dynamic";

export default async function AdminMessagePage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      fan: { select: { id: true, name: true, email: true, country: true } },
      celebrity: {
        select: {
          id: true,
          slug: true,
          name: true,
          profession: true,
          accentColor: true,
          profileImage: true,
          chatAccountLabel: true,
        },
      },
    },
  });

  if (!conversation) notFound();

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/messages"
          className="text-sm font-semibold text-primary-300 hover:text-primary-200"
        >
          ← Back to all messages
        </Link>
      </div>
      <AdminChatRoom
        conversationId={conversation.id}
        celebrity={conversation.celebrity}
        fan={{
          name: conversation.fan.name,
          email: conversation.fan.email,
          country: conversation.fan.country,
        }}
      />
    </div>
  );
}