import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId, isAdminAuthed } from "@/lib/auth";
import { isConversationAccessible } from "@/lib/chat/access";
import { touchFanPresence } from "@/lib/chat/presence";
import { getTyping } from "@/lib/chat/typing-store";
import { serializeSSE, type RealtimeEvent } from "@/lib/chat/realtime";

export const dynamic = "force-dynamic";

const POLL_MS = 2000;
const MAX_DURATION_MS = 300_000; // 5 minutes

export async function GET(request: Request) {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId") ?? "";
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  const sinceParam = url.searchParams.get("since");
  let since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60_000);
  if (isNaN(since.getTime())) since = new Date(Date.now() - 60_000);

  const fanId = await getCurrentFanId();
  const isAdmin = fanId ? false : await isAdminAuthed();
  const actorType = fanId ? "fan" : isAdmin ? "team" : null;

  if (!actorType) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accessible, conversation } = await isConversationAccessible(
    conversationId,
    actorType,
    fanId ?? "admin",
  );
  if (!accessible || !conversation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const celebrityId = conversation.celebrityId;

  if (fanId) {
    touchFanPresence(fanId).catch(() => {});
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      function send(event: RealtimeEvent) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(serializeSSE(event)));
        } catch {
          close();
        }
      }

      function close() {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        try { controller.close(); } catch {}
      }

      send({ type: "heartbeat" });

      async function poll() {
        if (closed) return;
        try {
          const messages = await prisma.chatMessage.findMany({
            where: {
              conversationId,
              createdAt: { gt: since },
              deletedAt: null,
            },
            orderBy: { createdAt: "asc" },
            take: 50,
          });

          for (const msg of messages) {
            send({ type: "message", message: msg });
            if (msg.createdAt > since) since = msg.createdAt;
          }

          if (fanId) {
            const online = await prisma.celebrity.findUnique({
              where: { id: celebrityId },
              select: { chatLastSeenAt: true },
            });
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
            const isOnline = !!(online?.chatLastSeenAt && online.chatLastSeenAt > fiveMinAgo);
            send({ type: "presence", celebrityId, online: isOnline });
          }

          const { fanTyping, teamTyping } = getTyping(conversationId);
          if (actorType === "fan" && teamTyping) {
            send({ type: "typing", conversationId, senderType: "team" });
          } else if (actorType === "team" && fanTyping) {
            send({ type: "typing", conversationId, senderType: "fan" });
          }
        } catch (err) {
          console.error("SSE poll error", err);
        }

        if (!closed) {
          timer = setTimeout(poll, POLL_MS);
        }
      }

      timer = setTimeout(poll, POLL_MS);

      const abortHandler = () => close();
      request.signal?.addEventListener("abort", abortHandler);

      setTimeout(close, MAX_DURATION_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
