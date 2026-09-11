import { prisma } from "@/lib/db";

export interface AdminConversationView {
  id: string;
  status: string;
  mutedByFan: boolean;
  pinnedByFan: boolean;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  lastMessageSender: string | null;
  unread: number;
  fan: {
    id: string;
    name: string;
    email: string;
    country: string | null;
    isActive: boolean;
  };
  celebrity: {
    id: string;
    slug: string;
    name: string;
    profession: string;
    accentColor: string;
    profileImage: string | null;
  };
  lastMessage: {
    senderType: string;
    body: string;
    type: string;
    createdAt: string;
  } | null;
}

export async function listAdminConversations(): Promise<AdminConversationView[]> {
  const conversations = await prisma.chatConversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    include: {
      fan: { select: { id: true, name: true, email: true, country: true, isActive: true } },
      celebrity: {
        select: {
          id: true,
          slug: true,
          name: true,
          profession: true,
          accentColor: true,
          profileImage: true,
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          senderType: true,
          body: true,
          type: true,
          createdAt: true,
        },
      },
    },
  });

  const unreadRows = await prisma.$queryRaw<{
    conversationId: string;
    total: number;
  }[]>`
    SELECT m."conversationId", COUNT(*)::int AS total
    FROM "ChatMessage" m
    JOIN "ChatConversation" c ON c.id = m."conversationId"
    LEFT JOIN "ChatReadState" r ON r."conversationId" = c.id
    WHERE m."deletedAt" IS NULL
      AND m."senderType" <> 'team'
      AND (r."teamLastReadAt" IS NULL OR m."createdAt" > r."teamLastReadAt")
    GROUP BY m."conversationId"
  `;
  const unreadMap = new Map(unreadRows.map((r) => [r.conversationId, r.total]));

  return conversations.map((c) => ({
    id: c.id,
    status: c.status,
    mutedByFan: c.mutedByFan,
    pinnedByFan: c.pinnedByFan,
    lastMessagePreview: c.lastMessagePreview,
    lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
    lastMessageSender: c.lastMessageSender,
    unread: unreadMap.get(c.id) ?? 0,
    fan: {
      id: c.fan.id,
      name: c.fan.name,
      email: c.fan.email,
      country: c.fan.country,
      isActive: c.fan.isActive,
    },
    celebrity: {
      id: c.celebrity.id,
      slug: c.celebrity.slug,
      name: c.celebrity.name,
      profession: c.celebrity.profession,
      accentColor: c.celebrity.accentColor,
      profileImage: c.celebrity.profileImage,
    },
    lastMessage: c.messages[0]
      ? {
          senderType: c.messages[0].senderType,
          body: c.messages[0].body,
          type: c.messages[0].type,
          createdAt: c.messages[0].createdAt.toISOString(),
        }
      : null,
  }));
}