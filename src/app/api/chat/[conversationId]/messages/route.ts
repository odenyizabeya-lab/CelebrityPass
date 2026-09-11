import { NextResponse } from "next/server";
import { getCurrentFanId, getCurrentAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isConversationAccessible, canFanSendMessage, canTeamSendMessage } from "@/lib/chat/access";
import { sendMessage, getMessages, type MessageWithReply } from "@/lib/chat/messages";
import { touchFanPresence, touchTeamPresence, isCelebrityOnline } from "@/lib/chat/presence";
import { sendChatMessageNotification } from "@/lib/emails/senders";
import { notifyFanPush } from "@/lib/chat/push";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ conversationId: string }> };

type Actor =
  | { type: "fan"; fanId: string; teamEmail: null }
  | { type: "team"; fanId: null; teamEmail: string };

async function resolveActor(): Promise<Actor | null> {
  const fanId = await getCurrentFanId();
  if (fanId) return { type: "fan", fanId, teamEmail: null };
  const teamEmail = await getCurrentAdminEmail();
  if (teamEmail) return { type: "team", fanId: null, teamEmail };
  return null;
}

export async function GET(request: Request, { params }: Ctx) {
  const { conversationId } = await params;
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);

  const actor = await resolveActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accessible, conversation } = await isConversationAccessible(
    conversationId,
    actor.type,
    actor.type === "fan" ? actor.fanId : actor.teamEmail,
  );
  if (!accessible || !conversation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (actor.fanId) touchFanPresence(actor.fanId).catch(() => {});

  const { messages, hasMore } = await getMessages(conversationId, { cursor, limit });
  const safeMessages = messages.map((m) => safeMessage(m, actor.fanId));

  return NextResponse.json({ messages: safeMessages, hasMore, conversation: { id: conversation.id, celebrityId: conversation.celebrityId, status: conversation.status } });
}

export async function POST(request: Request, { params }: Ctx) {
  const { conversationId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clientId !== "string") {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const actor = await resolveActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accessible, conversation } = await isConversationAccessible(
    conversationId,
    actor.type,
    actor.type === "fan" ? actor.fanId : actor.teamEmail,
  );
  if (!accessible || !conversation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const type = String(body.type ?? "text");
  const text = String(body.body ?? "");
  const attachmentJson = body.attachmentJson ? JSON.stringify(body.attachmentJson) : undefined;
  const repliedToId = body.repliedToId ? String(body.repliedToId) : undefined;

  if (!["text", "image", "voice", "video", "call", "system"].includes(type)) {
    return NextResponse.json({ error: "Invalid message type" }, { status: 400 });
  }
  if (type === "text" && text.length > 4000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  if (actor.type === "fan") {
    const { allowed, reason } = await canFanSendMessage(
      actor.fanId as string,
      conversation.celebrityId,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: reason ?? "Not allowed to send messages here" },
        { status: 403 },
      );
    }
    touchFanPresence(actor.fanId as string).catch(() => {});
  } else {
    const { allowed } = await canTeamSendMessage(actor.teamEmail);
    if (!allowed) {
      return NextResponse.json({ error: "Team messaging disabled" }, { status: 403 });
    }
    touchTeamPresence(conversation.celebrityId).catch(() => {});
  }

  const message = await sendMessage({
    conversationId,
    senderType: actor.type,
    fanId: actor.type === "fan" ? actor.fanId : undefined,
    teamEmail: actor.type === "team" ? actor.teamEmail : undefined,
    clientId: String(body.clientId),
    type,
    body: text,
    attachmentJson,
    repliedToId,
  });

  // Offline-recipient email notification (first message per conversation).
  // Fire-and-forget — email failures must never break message delivery.
  try {
    const [fan, celebrity] = await Promise.all([
      prisma.fan.findUnique({
        where: { id: conversation.fanId },
        select: { id: true, name: true, email: true, lastSeenAt: true, isActive: true, unsubscribedAt: true },
      }),
      prisma.celebrity.findUnique({
        where: { id: conversation.celebrityId },
        select: { name: true },
      }),
    ]);
    const preview = (text || (type === "image" ? "📷 Photo" : type === "voice" ? "🎤 Voice message" : type === "video" ? "🎬 Video" : "Message")).slice(0, 160);

    if (actor.type === "fan" && fan && fan.isActive && !fan.unsubscribedAt) {
      const online = await isCelebrityOnline(conversation.celebrityId);
      if (!online && celebrity) {
        await sendChatMessageNotification({
          direction: "toTeam",
          conversationId,
          celebrityName: celebrity.name,
          senderName: fan.name,
          preview,
          replyUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://celebritypass.app"}/admin/messages/${conversationId}`,
          replyLabel: "Open team inbox",
        });
      }
    } else if (actor.type === "team" && fan && fan.isActive && !fan.unsubscribedAt) {
      if (fan.lastSeenAt === null || fan.lastSeenAt < new Date(Date.now() - 5 * 60 * 1000)) {
        await sendChatMessageNotification({
          direction: "toFan",
          conversationId,
          celebrityName: celebrity?.name ?? "Your community",
          senderName: celebrity?.name ?? "Team",
          preview,
          replyUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://celebritypass.app"}/chat/${conversationId}`,
          replyLabel: "Open chat",
          fan,
        });

        // Native push (PWA + future native apps). Fire-and-forget alongside the email.
        await notifyFanPush(fan.id, {
          title: celebrity?.name ?? "New message",
          body: preview,
          url: `/chat/${conversationId}`,
        });
      }
    }
  } catch (err) {
    console.error("[chat] Email notification failed:", err);
  }

  return NextResponse.json({ message: safeMessage(message, actor.fanId) }, { status: 201 });
}

function safeMessage(m: MessageWithReply, fanId: string | null) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderType: m.senderType,
    fanId: m.senderType === "fan" ? (fanId === m.fanId ? m.fanId : "fan") : null,
    teamEmail: null,
    clientId: m.clientId,
    type: m.type,
    body: m.body,
    attachmentJson: m.attachmentJson,
    status: m.status,
    deliveredAt: m.deliveredAt,
    readAt: m.readAt,
    repliedToId: m.repliedToId,
    repliedTo: m.repliedTo
      ? {
          id: m.repliedTo.id,
          senderType: m.repliedTo.senderType,
          type: m.repliedTo.type,
          body: m.repliedTo.body,
          deletedAt: m.repliedTo.deletedAt,
        }
      : null,
    editedAt: m.editedAt,
    deletedAt: m.deletedAt,
    createdAt: m.createdAt,
  };
}