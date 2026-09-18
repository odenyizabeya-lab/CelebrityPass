import { prisma } from "@/lib/db";
import { getAdminEmails } from "@/lib/admin/settings";
import { CHAT_ACCESS_OFF_DEFAULT_MESSAGE } from "@/lib/chat/constants";
import { FAN_SYSTEM_OFF_MESSAGE } from "@/lib/profiles/classes";
import type { ChatConversation } from "@prisma/client";

/**
 * Per-celebrity Chat Access gate. When `chatAccessEnabled` is OFF, fans cannot
 * send ANY message — enforced here server-side, never in the UI alone. The
 * configured/public message the fan sees is the celebrity's `chatAccessOffMessage`
 * (falls back to the platform default).
 */
export async function canFanSendMessage(
  fanId: string,
  celebrityId: string,
): Promise<
  { allowed: boolean; reason?: string; chatAccessOff?: boolean }
> {
  const block = await prisma.chatBlock.findUnique({
    where: {
      fanId_celebrityId: { fanId, celebrityId },
    },
  });

  // Chat is free for every logged-in fan. Blocks, an inactive celebrity and the
  // per-celebrity Chat Access switch all restrict messaging; cards gate the
  // premium call features.
  if (block) {
    return { allowed: false, reason: "Messaging blocked for this celebrity" };
  }

  const celebrity = await prisma.celebrity.findUnique({
    where: { id: celebrityId },
    select: {
      isActive: true,
      chatAccessEnabled: true,
      chatAccessOffMessage: true,
      fansCardEnabled: true,
    },
  });
  if (!celebrity || !celebrity.isActive) {
    return { allowed: false, reason: "Chat is unavailable for this celebrity" };
  }
  if (celebrity.fansCardEnabled === false) {
    return { allowed: false, reason: FAN_SYSTEM_OFF_MESSAGE };
  }
  if (celebrity.chatAccessEnabled === false) {
    return {
      allowed: false,
      reason:
        celebrity.chatAccessOffMessage ?? CHAT_ACCESS_OFF_DEFAULT_MESSAGE,
      chatAccessOff: true,
    };
  }
  return { allowed: true };
}

/**
 * Read-only view of the chat gates so callers (e.g. the fan "start chat" API)
 * can open a room for display without accidently blocking the whole flow:
 * `blocked` controls whether a conversation may even exist for this fan, while
 * `chatAccessEnabled`/`chatAccessOffMessage` decide what the fan sees inside.
 */
export async function getFanChatGate(
  fanId: string,
  celebrityId: string,
): Promise<{
  blocked: boolean;
  reason?: string;
  chatAccessEnabled: boolean;
  chatAccessOffMessage: string;
}> {
  const block = await prisma.chatBlock.findUnique({
    where: { fanId_celebrityId: { fanId, celebrityId } },
  });
  if (block) {
    return {
      blocked: true,
      reason: "Messaging blocked for this celebrity",
      chatAccessEnabled: true,
      chatAccessOffMessage: CHAT_ACCESS_OFF_DEFAULT_MESSAGE,
    };
  }

  const celebrity = await prisma.celebrity.findUnique({
    where: { id: celebrityId },
    select: {
      isActive: true,
      chatAccessEnabled: true,
      chatAccessOffMessage: true,
      fansCardEnabled: true,
    },
  });
  if (!celebrity || !celebrity.isActive) {
    return {
      blocked: true,
      reason: "Chat is unavailable for this celebrity",
      chatAccessEnabled: true,
      chatAccessOffMessage: CHAT_ACCESS_OFF_DEFAULT_MESSAGE,
    };
  }
  if (celebrity.fansCardEnabled === false) {
    return {
      blocked: true,
      reason: FAN_SYSTEM_OFF_MESSAGE,
      chatAccessEnabled: true,
      chatAccessOffMessage: CHAT_ACCESS_OFF_DEFAULT_MESSAGE,
    };
  }
  return {
    blocked: false,
    chatAccessEnabled: celebrity.chatAccessEnabled,
    chatAccessOffMessage:
      celebrity.chatAccessOffMessage ?? CHAT_ACCESS_OFF_DEFAULT_MESSAGE,
  };
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
