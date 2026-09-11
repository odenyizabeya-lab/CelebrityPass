import { prisma } from "@/lib/db";

import type { ChatMessage } from "@prisma/client";

export type MessageWithReply = ChatMessage & {
  repliedTo?: {
    id: string;
    senderType: string;
    type: string;
    body: string;
    attachmentJson: string | null;
    deletedAt: Date | null;
    createdAt: Date;
  } | null;
};

export async function sendMessage(params: {
  conversationId: string;
  senderType: "fan" | "team" | "system";
  fanId?: string;
  teamEmail?: string;
  clientId: string;
  type?: string;
  body: string;
  attachmentJson?: string;
  repliedToId?: string;
}): Promise<ChatMessage> {
  const {
    conversationId,
    senderType,
    fanId,
    teamEmail,
    clientId,
    body,
    attachmentJson,
    repliedToId,
  } = params;
  const type = params.type ?? "text";
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.chatMessage.findUnique({
      where: { conversationId_clientId: { conversationId, clientId } },
    });
    if (existing) return existing;

    let message: ChatMessage;
    try {
      message = await tx.chatMessage.create({
        data: {
          conversationId,
          senderType,
          fanId,
          teamEmail,
          clientId,
          type,
          body,
          attachmentJson,
          repliedToId,
        },
      });
    } catch (e) {
      // Lost a retry race against a concurrent identical send — return the winner.
      if ((e as { code?: string } | null)?.code === "P2002") {
        return tx.chatMessage.findUniqueOrThrow({
          where: { conversationId_clientId: { conversationId, clientId } },
        });
      }
      throw e;
    }

    await tx.chatConversation.update({
      where: { id: conversationId },
      data: {
        lastMessagePreview: previewFor(body, type),
        lastMessageAt: now,
        lastMessageSender: senderType,
      },
    });

    if (senderType === "fan") {
      await tx.chatReadState.upsert({
        where: { conversationId },
        create: { conversationId, fanDeliveredUpTo: now },
        update: { fanDeliveredUpTo: now },
      });
    } else if (senderType === "team") {
      await tx.chatReadState.upsert({
        where: { conversationId },
        create: { conversationId, teamDeliveredUpTo: now },
        update: { teamDeliveredUpTo: now },
      });
    }

    return message;
  });
}

export async function getMessages(
  conversationId: string,
  opts?: { cursor?: string; limit?: number }
): Promise<{ messages: MessageWithReply[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(opts?.cursor
      ? { cursor: { id: opts.cursor }, skip: 1 }
      : {}),
    include: {
      repliedTo: {
        select: {
          id: true,
          senderType: true,
          type: true,
          body: true,
          attachmentJson: true,
          deletedAt: true,
          createdAt: true,
        },
      },
    },
  });

  const hasMore = rows.length > limit;
  return {
    messages: (hasMore ? rows.slice(0, limit) : rows) as MessageWithReply[],
    hasMore,
  };
}

export async function editMessage(
  messageId: string,
  editorType: "fan" | "team",
  editorId: string,
  newBody: string
): Promise<ChatMessage | null> {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt || message.editedAt) return null;
  if (editorType === "fan" && (message.senderType !== "fan" || message.fanId !== editorId))
    return null;
  if (Date.now() - message.createdAt.getTime() > 15 * 60 * 1000) return null;

  return prisma.chatMessage.update({
    where: { id: messageId },
    data: { body: newBody, editedAt: new Date() },
  });
}

export async function deleteMessage(
  messageId: string,
  deleterType: "fan" | "team",
  deleterId: string
): Promise<boolean> {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) return false;
  if (deleterType === "fan" && (message.senderType !== "fan" || message.fanId !== deleterId))
    return false;

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), body: "" },
  });
  return true;
}

export async function markRead(
  conversationId: string,
  readerType: "fan" | "team"
): Promise<void> {
  const now = new Date();
  const state = await prisma.chatReadState.findUnique({ where: { conversationId } });

  if (readerType === "fan") {
    if (state && state.fanLastReadAt && state.fanLastReadAt >= now) return;
    await prisma.chatReadState.upsert({
      where: { conversationId },
      create: { conversationId, fanLastReadAt: now },
      update: { fanLastReadAt: now },
    });
  } else {
    if (state && state.teamLastReadAt && state.teamLastReadAt >= now) return;
    await prisma.chatReadState.upsert({
      where: { conversationId },
      create: { conversationId, teamLastReadAt: now },
      update: { teamLastReadAt: now },
    });
  }
}

export async function getUnreadCount(fanId: string): Promise<number> {
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

function previewFor(body: string, type: string): string {
  if (type === "image") return "[Photo]";
  if (type === "voice") return "[Voice note]";
  if (type === "video") return "[Video]";
  if (type === "call") return "[Call]";
  const single = (body ?? "").replace(/\s+/g, " ").trim();
  if (!single) return "";
  return single.length > 80 ? single.slice(0, 80).trimEnd() + "…" : single;
}