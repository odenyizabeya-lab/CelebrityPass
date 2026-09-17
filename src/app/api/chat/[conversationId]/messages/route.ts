import { NextResponse } from "next/server";
import { getCurrentFanId, getCurrentAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isConversationAccessible, canFanSendMessage, canTeamSendMessage } from "@/lib/chat/access";
import { sendMessage, getMessages, markRead, type MessageWithReply } from "@/lib/chat/messages";
import { setTyping } from "@/lib/chat/typing-store";
import { withDbRetry } from "@/lib/db/retry";
import { touchFanPresence, touchTeamPresence, isCelebrityOnline } from "@/lib/chat/presence";
import { sendChatMessageNotification } from "@/lib/emails/senders";
import { notifyFanOnTeamMessage } from "@/lib/chat/push";
import { maybeAutoReply, catchUpUnansweredFanMessage } from "@/lib/chat/autoReply";
import { fanHasActiveCard, lockConversationForPass, resolveFanConversationStatus, PASS_LOCKED_STATUS, PASS_REQUIRED_ERROR } from "@/lib/chat/passGate";
import { rememberAsync } from "@/lib/ai/memory";

export const dynamic = "force-dynamic";
// The always-on AI composes a reply after the fan message lands and the HTTP
// response is already sent (fire-and-forget). Keep the serverless function
// alive long enough for that compose (Gemini search attempt + plain retry ~20s)
// to finish instead of freezing mid-reply.
export const maxDuration = 60;

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

  if (actor.type === "fan") {
    // Buying the CelebrityPass unlocks a previously pass-locked chat instantly.
    const effectiveStatus = await resolveFanConversationStatus(
      actor.fanId,
      conversation.celebrityId,
      conversationId,
      conversation.status,
    );
    conversation.status = effectiveStatus;
  }

  // Catch-up: if the newest message is an unanswered fan message, run the
  // always-on AI reply inside this request so fans are never left hanging even
  // when the fan-POST's fire-and-forget froze or hit a pooler blip. Blocking
  // here guarantees the reply completes within the request lifecycle, and it
  // becomes part of this poll's snapshot. Fan polls only — the admin team
  // inbox must never spawn AI replies.
  if (actor.type === "fan") {
    try {
      await catchUpUnansweredFanMessage(conversationId);
    } catch (err) {
      console.error("[chat] catch-up auto-reply failed:", err);
    }
  }

  const readState = await prisma.chatReadState.findUnique({
    where: { conversationId },
    select: { fanLastReadAt: true, teamLastReadAt: true },
  });

  const { messages, hasMore } = await getMessages(conversationId, { cursor, limit });
  const safeMessages = messages.map((m) => safeMessage(m, actor.fanId));

  return NextResponse.json({
    messages: safeMessages,
    hasMore,
    conversation: {
      id: conversation.id,
      celebrityId: conversation.celebrityId,
      status: conversation.status,
    },
    readState: {
      fanLastReadAt: readState?.fanLastReadAt ?? null,
      teamLastReadAt: readState?.teamLastReadAt ?? null,
    },
  });
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
  const attachmentJson = body.attachmentJson
    ? typeof body.attachmentJson === "string"
      ? body.attachmentJson
      : JSON.stringify(body.attachmentJson)
    : undefined;
  const repliedToId = body.repliedToId ? String(body.repliedToId) : undefined;

  if (!["text", "image", "voice", "video", "call", "system"].includes(type)) {
    return NextResponse.json({ error: "Invalid message type" }, { status: 400 });
  }
  if (type === "text" && text.length > 4000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  let fanHasPass = true;
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
    // CelebrityPass gate: a fan without a card may send AT MOST the message that
    // triggers the AI's "get your CelebrityPass" reply; once the conversation is
    // locked, no further messages land until they hold an active card.
    fanHasPass = await fanHasActiveCard(actor.fanId as string, conversation.celebrityId);
    if (fanHasPass) {
      // Buying the card unlocks a previously pass-locked chat instantly.
      if (conversation.status === PASS_LOCKED_STATUS) {
        conversation.status = await resolveFanConversationStatus(
          actor.fanId as string,
          conversation.celebrityId,
          conversationId,
          conversation.status,
        );
      }
    } else if (conversation.status === PASS_LOCKED_STATUS) {
      return NextResponse.json(
        { error: PASS_REQUIRED_ERROR, passRequired: true },
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

  const message = await withDbRetry(() =>
    sendMessage({
      conversationId,
      senderType: actor.type,
      fanId: actor.type === "fan" ? actor.fanId : undefined,
      teamEmail: actor.type === "team" ? actor.teamEmail : undefined,
      clientId: String(body.clientId),
      type,
      body: text,
      attachmentJson,
      repliedToId,
    }),
  );

  // Offline-recipient email notification (first message per conversation).
  // Fire-and-forget — email failures must never break message delivery, and
  // slow email round-trips must never delay the send ack (the delivered tick).
  if (actor.type === "fan" || actor.type === "team") {
    void (async () => {
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
          }

          // Phone push (PWA). Fire-and-forget: goes out whenever a team message
          // lands, even if the fan just went to the background a second ago —
          // unless they already read this exact message live.
          void notifyFanOnTeamMessage({
            conversationId,
            fanId: fan.id,
            celebrityName: celebrity?.name ?? "New message",
            preview,
            messageCreatedAt: message.createdAt,
          });
        }
      } catch (err) {
        console.error("[chat] Email notification failed:", err);
      }
    })();
  }

  // The celebrity's always-on AI replies on its own when a fan messages.
  // Fire-and-forget — a slow reply must never delay the fan's message landing.
  if (actor.type === "fan" && ["text", "voice", "image", "video"].includes(type)) {
    // The celebrity "reads" the moment the message lands: flip the blue tick
    // and the typing bubble instantly (durable + in-memory), independent of
    // how long the AI's composer takes. Durable read state is what the SSE
    // stream watches, so this must not wait for the AI.
    markRead(conversationId, "team").catch(() => {});
    setTyping(conversationId, "team");
    // Remember what matters about this fan so the AI builds on past chats.
    rememberAsync({ conversationId, latestFanText: type === "text" ? text : `[sent ${type}]` });
    void maybeAutoReply(conversationId).catch((err) => console.error("[autoReply] trigger failed:", err));
  }

  // Passless fan: their first message just stored — lock the chat now so a fast
  // double-send can't slip in before the AI's canned reply lands.
  if (actor.type === "fan" && !fanHasPass) {
    await lockConversationForPass(conversationId);
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