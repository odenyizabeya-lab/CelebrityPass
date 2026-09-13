import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/chat/messages";
import { setTyping, clearTyping } from "@/lib/chat/typing-store";
import { touchTeamPresence } from "@/lib/chat/presence";
import { composeAutoReply } from "@/lib/ai/assistant";
import { sendChatMessageNotification } from "@/lib/emails/senders";
import { notifyFanPush } from "@/lib/chat/push";
import { randomUUID } from "node:crypto";

/**
 * Always-on chat assistant.
 *
 * When a fan sends a message into any conversation, the celebrity's AI replies
 * on its own, human-to-human, as if the celebrity themselves texted back — no
 * switches, no time limits, 24/7. Replies are triggered whenever a fan message
 * lands; the AI greets questions, keeps chats alive, and wraps up warmly when a
 * fan says they're busy or leaving.
 *
 * Safety guards (only to prevent stuck states/double messages — never off or
 * time limits): we only answer the newest fan message, never answer when a
 * reply already landed, and never echo a sent message back into Gemini.
 */
const AI_TEAM_EMAIL = process.env.AI_TEAM_EMAIL || "celebrity-ai@celebritypass.app";

const PENDING = new Map<string, boolean>();
let warnedNoKey = false;

export async function maybeAutoReply(conversationId: string): Promise<void> {
  if (PENDING.get(conversationId)) return;
  PENDING.set(conversationId, true);
  try {
    await runAutoReply(conversationId);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Conversation not found")) return;
    console.error("[autoReply] failed:", err);
  } finally {
    PENDING.delete(conversationId);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function humanDelay() {
  return 3000 + Math.floor(Math.random() * 3500); // 3.0–6.5s, like real typing
}

async function newestRaw(conversationId: string) {
  return prisma.chatMessage.findFirst({
    where: { conversationId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, senderType: true, repliedToId: true, createdAt: true },
  });
}

/**
 * True when the newest message isn't an unanswered fan message (team/system
 * already moved the chat forward, or the newest fan message already has a
 * recent team reply pointed at it).
 */
async function alreadyAnswered(conversationId: string): Promise<boolean> {
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 4,
    select: { id: true, senderType: true, repliedToId: true, createdAt: true },
  });
  if (!rows.length) return false;
  if (rows[0].senderType !== "fan") return true;
  const target = rows[0].id;
  return rows.some(
    (r) => r.senderType === "team" && r.repliedToId === target && Date.now() - r.createdAt.getTime() < 120_000,
  );
}

async function runAutoReply(conversationId: string) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      celebrity: { select: { id: true, name: true, profession: true, country: true, bio: true, chatAiStyle: true } },
      fan: { select: { id: true, name: true, email: true, lastSeenAt: true, isActive: true, unsubscribedAt: true } },
    },
  });
  if (!conversation || !conversation.celebrity?.name) return;
  const fan = conversation.fan;
  if (!fan || !fan.isActive || fan.unsubscribedAt) return;

  if (!(await newestRaw(conversationId)) || (await newestRaw(conversationId))!.senderType !== "fan") return;
  if (await alreadyAnswered(conversationId)) return;

  // Fan sees "celebrity is typing…" while the reply is crafted.
  setTyping(conversationId, "team");
  touchTeamPresence(conversation.celebrity.id).catch(() => {});
  await sleep(humanDelay());

  if (await alreadyAnswered(conversationId)) return;

  const result = await composeAutoReply(conversationId);
  if (!result?.text?.trim()) return;

  if (!result.configured && !warnedNoKey) {
    warnedNoKey = true;
    console.warn("[autoReply] ASSIST_GEMINI_KEY is not set — auto-replies are using offline templates. Add the key for real chats.");
  }

  // Re-signal typing right before landing, then finish the "typing" beat.
  setTyping(conversationId, "team");
  await sleep(900 + Math.floor(Math.random() * 1500));
  if (await alreadyAnswered(conversationId)) return;

  const target = await newestRaw(conversationId);
  if (!target || target.senderType !== "fan") return;

  const message = await sendMessage({
    conversationId,
    senderType: "team",
    fanId: undefined,
    teamEmail: AI_TEAM_EMAIL,
    clientId: `auto-${randomUUID()}`,
    type: "text",
    body: result.text,
    repliedToId: target.id,
  });
  clearTyping(conversationId, "team");

  // Let the fan know a reply landed (email + push when they're away).
  try {
    const preview = message.body.slice(0, 160);
    if (fan.lastSeenAt === null || fan.lastSeenAt < new Date(Date.now() - 5 * 60 * 1000)) {
      await sendChatMessageNotification({
        direction: "toFan",
        conversationId,
        celebrityName: conversation.celebrity.name,
        senderName: conversation.celebrity.name,
        preview,
        replyUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://celebritypass.app"}/chat/${conversationId}`,
        replyLabel: "Open chat",
        fan,
      });
      await notifyFanPush(fan.id, {
        title: conversation.celebrity.name,
        body: preview,
        url: `/chat/${conversationId}`,
      });
    }
  } catch (err) {
    console.error("[autoReply] Fan notification failed:", err);
  }
}