import { notFound } from "next/navigation";
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
          isVerified: true,
        },
      },
    },
  });

  if (!conversation) notFound();

  return (
    <AdminChatRoom
      conversationId={conversation.id}
      celebrity={conversation.celebrity}
      fan={{
        name: conversation.fan.name,
        email: conversation.fan.email,
        country: conversation.fan.country,
      }}
    />
  );
}