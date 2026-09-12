import { prisma } from "@/lib/db";
import { profileImageUrl } from "@/lib/images";

/** Total unread message count across all of a fan's conversations. */
export async function getFanUnreadTotal(fanId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS total
    FROM "ChatMessage" m
    JOIN "ChatConversation" c ON c.id = m."conversationId"
    LEFT JOIN "ChatReadState" r ON r."conversationId" = c.id
    WHERE c."fanId" = ${fanId}
      AND m."deletedAt" IS NULL
      AND m."senderType" <> 'fan'
      AND (r."fanLastReadAt" IS NULL OR m."createdAt" > r."fanLastReadAt")
  `;
  return rows[0]?.total ?? 0;
}

export interface FanConversationView {
  id: string;
  status: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  lastMessageSender: string | null;
  muted: boolean;
  pinned: boolean;
  unread: number;
  celebrity: {
    id: string;
    slug: string;
    name: string;
    profession: string;
    profileImage: string | null;
    chatAccountType: string;
    chatAccountLabel: string | null;
    online: boolean;
  };
  lastMessage: {
    id: string;
    senderType: string;
    body: string;
    type: string;
    createdAt: string;
    status: string;
  } | null;
}

export async function listFanConversations(
  fanId: string,
): Promise<FanConversationView[]> {
  const conversations = await prisma.chatConversation.findMany({
    where: { fanId },
    orderBy: [{ pinnedByFan: "desc" }, { lastMessageAt: "desc" }],
    include: {
      celebrity: {
        select: {
          id: true,
          slug: true,
          name: true,
          profession: true,
          profileImage: true,
          chatAccountType: true,
          chatAccountLabel: true,
          chatLastSeenAt: true,
        },
      },
      readState: true,
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          senderType: true,
          body: true,
          type: true,
          createdAt: true,
          status: true,
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
    WHERE c."fanId" = ${fanId}
      AND m."deletedAt" IS NULL
      AND m."senderType" <> 'fan'
      AND (r."fanLastReadAt" IS NULL OR m."createdAt" > r."fanLastReadAt")
    GROUP BY m."conversationId"
  `;
  const unreadMap = new Map(unreadRows.map((r) => [r.conversationId, r.total]));

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  return conversations.map((c) => ({
    id: c.id,
    status: c.status,
    lastMessagePreview: c.lastMessagePreview,
    lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
    lastMessageSender: c.lastMessageSender,
    muted: c.mutedByFan,
    pinned: c.pinnedByFan,
    unread: unreadMap.get(c.id) ?? 0,
    celebrity: {
      id: c.celebrity.id,
      slug: c.celebrity.slug,
      name: c.celebrity.name,
      profession: c.celebrity.profession,
      // URL (never the raw base64 blob), served from the cacheable endpoint.
      profileImage: profileImageUrl(c.celebrity.slug, c.celebrity.profileImage),
      chatAccountType: c.celebrity.chatAccountType,
      chatAccountLabel: c.celebrity.chatAccountLabel,
      online: !!(c.celebrity.chatLastSeenAt && c.celebrity.chatLastSeenAt > fiveMinAgo),
    },
    lastMessage: c.messages[0]
      ? {
          id: c.messages[0].id,
          senderType: c.messages[0].senderType,
          body: c.messages[0].body,
          type: c.messages[0].type,
          createdAt: c.messages[0].createdAt.toISOString(),
          status: c.messages[0].status,
        }
      : null,
  }));
}