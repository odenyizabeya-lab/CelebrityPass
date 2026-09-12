import { prisma } from "@/lib/db";
import { getAdminEmails } from "@/lib/admin/settings";
import type { ChatConversation } from "@prisma/client";

export async function canFanSendMessage(
  fanId: string,
  celebrityId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const block = await prisma.chatBlock.findUnique({
    where: {
      fanId_celebrityId: { fanId, celebrityId },
    },
  });

  // Chat is free for every logged-in fan. Only blocks (and, upstream, the
  // celebrity being active) restrict messaging; cards gate the premium call features.
  if (block) {
    return { allowed: false, reason: "Messaging blocked for this celebrity" };
  }
  return { allowed: true };
}

export async function getOrCreateConversation(
  fanId: string,
  celebrityId: string,
): Promise<ChatConversation> {
  return prisma.chatConversation.upsert({
    where: {
      fanId_celebrityId: { fanId, celebrityId },
    },
    update: {},
    create: {
      fanId,
      celebrityId,
    },
  });
}

export async function canTeamSendMessage(
  teamEmail: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const adminEmails = await getAdminEmails();
  if (!adminEmails.includes(teamEmail)) {
    return { allowed: false, reason: "Not a recognized team admin email" };
  }
  return { allowed: true };
}

export async function isConversationAccessible(
  conversationId: string,
  actorType: "fan" | "team",
  actorId: string,
): Promise<{ accessible: boolean; conversation?: ChatConversation }> {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    return { accessible: false };
  }

  if (actorType === "fan") {
    return {
      accessible: conversation.fanId === actorId,
      conversation,
    };
  }

  const adminEmails = await getAdminEmails();
  if (!adminEmails.includes(actorId)) {
    return { accessible: false, conversation };
  }

  return { accessible: true, conversation };
}
