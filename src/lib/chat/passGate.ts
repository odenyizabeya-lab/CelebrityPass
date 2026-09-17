// CelebrityPass chat gate.
//
// Fans without an active CelebrityPass (fan card) for a celebrity cannot chat
// there. Their very first message earns one sweet canned reply from the
// celebrity telling them to get their pass, then the conversation is locked
// (status LOCKED_NEEDS_PASS): the composer disables and further sends are
// rejected until the fan holds an active card, after which the chat unlocks
// automatically on the next open/send.
//
// The lock lives in the existing ChatConversation.status string column — no
// schema change. Card holders (status ACTIVE) are unaffected and get the
// normal always-on AI chat.
import { prisma } from "@/lib/db";

export const PASS_LOCKED_STATUS = "LOCKED_NEEDS_PASS";
export const PASS_REQUIRED_ERROR = "Get your CelebrityPass to chat here";
export const PASS_REQUIRED_ERROR_SHORT = "Chat locked — get your CelebrityPass";

export async function fanHasActiveCard(fanId: string, celebrityId: string): Promise<boolean> {
  try {
    const card = await prisma.fanCard.findUnique({
      where: { fanId_celebrityId: { fanId, celebrityId } },
      select: { status: true },
    });
    return card?.status === "ACTIVE";
  } catch {
    return false;
  }
}

export async function lockConversationForPass(conversationId: string): Promise<void> {
  try {
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { status: PASS_LOCKED_STATUS },
    });
  } catch {
    // best-effort — the send gate and UI still enforce the lock on their side.
  }
}

/**
 * Whenever a fan opens their chat, a LOCKED_NEEDS_PASS conversation unlocks the
 * moment they hold an ACTIVE card — buying the pass re-opens the chat without
 * admin help. Returns the status the conversation should be reported as.
 */
export async function resolveFanConversationStatus(
  fanId: string,
  celebrityId: string,
  conversationId: string,
  currentStatus: string,
): Promise<string> {
  if (currentStatus !== PASS_LOCKED_STATUS) return currentStatus;
  if (await fanHasActiveCard(fanId, celebrityId)) {
    try {
      await prisma.chatConversation.update({
        where: { id: conversationId },
        data: { status: "ACTIVE" },
      });
      return "ACTIVE";
    } catch {
      return currentStatus;
    }
  }
  return currentStatus;
}

function firstWord(name: string): string {
  return (name ?? "").split(/\s+/)[0] || "there";
}

/** Canned, always-human celebrity reply — the ONLY thing a passless fan hears. */
export function passGateReply(fanName: string, celebrityName: string): string {
  const name = firstWord(fanName);
  const replies = [
    `${name}, before we can talk here, you first need your very own CelebrityPass — this chat only opens for my true fans who hold their pass. Please get yours, sweetheart, and the moment you do, I'll be right here to talk to you properly.`,
    `Sweetheart, this chat with ${celebrityName} only opens for real fans who hold their CelebrityPass. Get yours and the chat will open up for us right away — I'll be waiting for you, I promise.`,
    `${name}, my chat with ${celebrityName} stays closed until you have your CelebrityPass — it takes just a minute to get, and then we can finally talk. Get your pass and come back to me, okay. I'm counting on it.`,
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}