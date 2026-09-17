import { prisma } from "@/lib/db";
import { celebrityImageFlags } from "@/lib/images";
import { CHAT_ACCESS_OFF_DEFAULT_MESSAGE } from "@/lib/chat/constants";

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
    chatAccessEnabled: boolean;
    chatAccessOffMessage: string;
    online: boolean;
    isVerified: boolean;
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

interface ConversationRow {
  id: string;
  status: string;
  lastMessagePreview: string | null;
  lastMessageAt: Date | null;
  lastMessageSender: string | null;
  mutedByFan: boolean;
  pinnedByFan: boolean;
  celebrityId: string;
  slug: string;
  name: string;
  profession: string;
  chatAccountType: string;
  chatAccountLabel: string | null;
  chatLastSeenAt: Date | null;
  chatAccessEnabled: boolean;
  chatAccessOffMessage: string | null;
  isVerified: boolean;
  lastMessageId: string | null;
  lastMessageType: string | null;
  lastMessageBody: string | null;
  lastMessageCreatedAt: Date | null;
  lastMessageStatus: string | null;
  lastMessageSenderType: string | null;
  unread: number;
}

/**
 * Fan conversation list in ONE round trip: conversations joined with the
 * celebrity, the newest non-deleted message and per-conversation unread counts,
 * plus a LATERAL subquery for the last message. The old implementation ran
 * three separate queries (conversations+last message, unread counts, then the
 * global celebrity image-flag query) and multiplied the mobile latency of the
 * Messages page — this keeps the wire cost to a single trip + the memoized
 * image-flag lookup.
 */
export async function listFanConversations(
  fanId: string,
): Promise<FanConversationView[]> {
  const rows = await prisma.$queryRaw<ConversationRow[]>`
    SELECT
      c.id,
      c.status,
      c."lastMessagePreview",
      c."lastMessageAt",
      c."lastMessageSender",
      c."mutedByFan",
      c."pinnedByFan",
      c."celebrityId",
      cel."slug",
      cel."name",
      cel."profession",
      cel."chatAccountType",
      cel."chatAccountLabel",
      cel."chatLastSeenAt",
      cel."chatAccessEnabled",
      cel."chatAccessOffMessage",
      cel."isVerified",
      lm.id            AS "lastMessageId",
      lm.type          AS "lastMessageType",
      lm.body          AS "lastMessageBody",
      lm."createdAt"   AS "lastMessageCreatedAt",
      lm.status        AS "lastMessageStatus",
      lm."senderType"  AS "lastMessageSenderType",
      COALESCE((
        SELECT COUNT(*)::int
        FROM "ChatMessage" m
        WHERE m."conversationId" = c.id
          AND m."deletedAt" IS NULL
          AND m."senderType" <> 'fan'
          AND (rs."fanLastReadAt" IS NULL OR m."createdAt" > rs."fanLastReadAt")
      ), 0)::int AS unread
    FROM "ChatConversation" c
    JOIN "Celebrity" cel ON cel.id = c."celebrityId"
    LEFT JOIN "ChatReadState" rs ON rs."conversationId" = c.id
    LEFT JOIN LATERAL (
      SELECT m2."id", m2."senderType", m2."body", m2."type", m2."status", m2."createdAt"
      FROM "ChatMessage" m2
      WHERE m2."conversationId" = c.id AND m2."deletedAt" IS NULL
      ORDER BY m2."createdAt" DESC, m2."id" DESC
      LIMIT 1
    ) lm ON TRUE
    WHERE c."fanId" = ${fanId}
    ORDER BY c."pinnedByFan" DESC, c."lastMessageAt" DESC
  `;

  const imageFlags = await celebrityImageFlags();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    lastMessagePreview: r.lastMessagePreview,
    lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
    lastMessageSender: r.lastMessageSender,
    muted: r.mutedByFan,
    pinned: r.pinnedByFan,
    unread: r.unread ?? 0,
    celebrity: {
      id: r.celebrityId,
      slug: r.slug,
      name: r.name,
      profession: r.profession,
      // URL (never the raw base64 blob), served from the cacheable endpoint.
      profileImage: imageFlags.get(r.slug)?.hasProfile
        ? `/images/${r.slug}/profile`
        : null,
      chatAccountType: r.chatAccountType,
      chatAccountLabel: r.chatAccountLabel,
      chatAccessEnabled: r.chatAccessEnabled,
      chatAccessOffMessage:
        r.chatAccessOffMessage ?? CHAT_ACCESS_OFF_DEFAULT_MESSAGE,
      online: !!(r.chatLastSeenAt && r.chatLastSeenAt > fiveMinAgo),
      isVerified: r.isVerified,
    },
    lastMessage: r.lastMessageId
      ? {
          id: r.lastMessageId,
          senderType: r.lastMessageSenderType ?? r.lastMessageSender ?? "team",
          body: r.lastMessageBody ?? "",
          type: r.lastMessageType ?? "text",
          createdAt: r.lastMessageCreatedAt
            ? r.lastMessageCreatedAt.toISOString()
            : "",
          status: r.lastMessageStatus ?? "SENT",
        }
      : null,
  }));
}