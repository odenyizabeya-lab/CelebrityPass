import { prisma } from "@/lib/db";
import { celebrityImageFlags } from "@/lib/images";
import { CHAT_ACCESS_OFF_DEFAULT_MESSAGE } from "@/lib/chat/constants";

export interface AdminConversationView {
  id: string;
  status: string;
  aiMode: string; // "auto" (AI replies on) | "manual" (team-only / took over)
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
    isOnline: boolean;
    lastSeenAt: string | null;
    hasPass: boolean;
  };
  celebrity: {
    id: string;
    slug: string;
    name: string;
    profession: string;
    accentColor: string;
    profileImage: string | null;
    isVerified: boolean;
    isOnline: boolean;
    chatAccessEnabled: boolean;
    chatAccessOffMessage: string;
  };
  lastMessage: {
    senderType: string;
    body: string;
    type: string;
    createdAt: string;
  } | null;
}

/** Total team-unread messages across every conversation (admin nav badge). */
export async function getAdminUnreadTotal(): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS total
    FROM "ChatMessage" m
    JOIN "ChatConversation" c ON c.id = m."conversationId"
    LEFT JOIN "ChatReadState" r ON r."conversationId" = c.id
    WHERE m."deletedAt" IS NULL
      AND m."senderType" <> 'team'
      AND (r."teamLastReadAt" IS NULL OR m."createdAt" > r."teamLastReadAt")
  `;
  return rows[0]?.total ?? 0;
}

export async function listAdminConversations(): Promise<AdminConversationView[]> {
  const conversations = await prisma.chatConversation.findMany({
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    include: {
      fan: {
        select: {
          id: true,
          name: true,
          email: true,
          country: true,
          isActive: true,
          lastSeenAt: true,
        },
      },
      celebrity: {
        select: {
          id: true,
          slug: true,
          name: true,
          profession: true,
          accentColor: true,
          isVerified: true,
          chatLastSeenAt: true,
          chatAccessEnabled: true,
          chatAccessOffMessage: true,
          // profileImage blob intentionally not selected (see list.ts).
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

  const passRows = await prisma.fanCard.findMany({
    where: { status: "ACTIVE" },
    select: { fanId: true, celebrityId: true },
  });
  const passSet = new Set(passRows.map((p) => `${p.fanId}:${p.celebrityId}`));

  const imageFlags = await celebrityImageFlags();
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;

  return conversations.map((c) => ({
    id: c.id,
    status: c.status,
    aiMode: c.aiMode,
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
      isOnline:
        !!c.fan.lastSeenAt && new Date(c.fan.lastSeenAt).getTime() > fiveMinAgo,
      lastSeenAt: c.fan.lastSeenAt ? c.fan.lastSeenAt.toISOString() : null,
      hasPass: passSet.has(`${c.fan.id}:${c.celebrity.id}`),
    },
    celebrity: {
      id: c.celebrity.id,
      slug: c.celebrity.slug,
      name: c.celebrity.name,
      profession: c.celebrity.profession,
      accentColor: c.celebrity.accentColor,
      profileImage: imageFlags.get(c.celebrity.slug)?.hasProfile
        ? `/images/${c.celebrity.slug}/profile`
        : null,
      isVerified: c.celebrity.isVerified,
      isOnline:
        !!c.celebrity.chatLastSeenAt &&
        new Date(c.celebrity.chatLastSeenAt).getTime() > fiveMinAgo,
      chatAccessEnabled: c.celebrity.chatAccessEnabled,
      chatAccessOffMessage:
        c.celebrity.chatAccessOffMessage ?? CHAT_ACCESS_OFF_DEFAULT_MESSAGE,
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