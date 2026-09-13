import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId, isAdminAuthed } from "@/lib/auth";
import { isConversationAccessible } from "@/lib/chat/access";
import { touchFanPresence } from "@/lib/chat/presence";
import { getTyping } from "@/lib/chat/typing-store";
import { serializeSSE, type RealtimeEvent } from "@/lib/chat/realtime";

export const dynamic = "force-dynamic";

const POLL_MS = 2000;
// Heartbeat frequently enough that idle proxies, carrier NATs and mobile
// networks never kill a healthy but quiet stream. This is what kept killing
// the old single-heartbeat streams mid-window.
const HEARTBEAT_MS = 20_000;
// Sanity cap only — with periodic heartbeats streams stay alive indefinitely,
// and cleanup still happens when the client disconnects (request.signal).
const MAX_DURATION_MS = 1_800_000; // 30 minutes

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
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

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
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try { controller.close(); } catch {}
      }

      send({ type: "heartbeat" });

      // Keep the stream alive on a cadence independent of the poll loop: even
      // with zero traffic the client gets a liveness signal every 20s.
      heartbeatTimer = setInterval(() => {
        send({ type: "heartbeat" });
      }, HEARTBEAT_MS);

      // Cursor over the poll stream. `gte` (not `gt`) + a set of already-emitted
      // message ids for the boundary timestamp guarantees a same-millisecond
      // message can never be skipped and lost forever.
      let cursor: Date = since;
      let cursorIds = new Set<string>();
      let presenceTick = 0;
      let lastOnline: boolean | null = null;
      let lastTeamReadAt: string | null = null;
      let lastFanReadAt: string | null = null;

      async function poll() {
        if (closed) return;
        try {
          const messages = await prisma.chatMessage.findMany({
            where: {
              conversationId,
              createdAt: { gte: cursor },
              deletedAt: null,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 200,
          });

          let streamCursor = cursor;
          let streamCursorIds = new Set<string>();
          let emitted = 0;

          for (const msg of messages) {
            const boundary =
              msg.createdAt.getTime() === cursor.getTime() &&
              cursorIds.has(msg.id);
            if (boundary) continue;
            send({ type: "message", message: msg });
            emitted += 1;
            const t = msg.createdAt.getTime();
            if (t > streamCursor.getTime()) {
              streamCursor = msg.createdAt;
              streamCursorIds = new Set([msg.id]);
            } else if (t === streamCursor.getTime()) {
              streamCursorIds.add(msg.id);
            }
          }

          if (emitted > 0) {
            cursor = streamCursor;
            cursorIds = streamCursorIds;
          }

          if (fanId) {
            // Presence re-check every 5th poll (10s) — cheaper than every 2s,
            // and only emit when the online state actually changes so an idle
            // stream isn't spitting identical presence events forever.
            presenceTick += 1;
            if (presenceTick % 5 === 1) {
              const online = await prisma.celebrity.findUnique({
                where: { id: celebrityId },
                select: { chatLastSeenAt: true },
              });
              const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
              const isOnline = !!(online?.chatLastSeenAt && online.chatLastSeenAt > fiveMinAgo);
              if (isOnline !== lastOnline) {
                lastOnline = isOnline;
                send({ type: "presence", celebrityId, online: isOnline });
              }
            }
          }

          const { fanTyping, teamTyping } = getTyping(conversationId);
          if (actorType === "fan" && teamTyping) {
            send({ type: "typing", conversationId, senderType: "team" });
          } else if (actorType === "team" && fanTyping) {
            send({ type: "typing", conversationId, senderType: "fan" });
          }

          // Read receipts: whenever a participant's read watermark advances,
          // broadcast it so the other side flips to the blue double-tick instantly.
          const readState = await prisma.chatReadState.findUnique({
            where: { conversationId },
            select: { teamLastReadAt: true, fanLastReadAt: true },
          });
          const teamReadAt = readState?.teamLastReadAt?.toISOString() ?? null;
          const fanReadAt = readState?.fanLastReadAt?.toISOString() ?? null;
          if (teamReadAt !== lastTeamReadAt && teamReadAt) {
            lastTeamReadAt = teamReadAt;
            send({ type: "read", conversationId, readerType: "team", at: teamReadAt });
          }
          if (fanReadAt !== lastFanReadAt && fanReadAt) {
            lastFanReadAt = fanReadAt;
            send({ type: "read", conversationId, readerType: "fan", at: fanReadAt });
          }
        } catch (err) {
          console.error("SSE poll error", err);
        }

        if (!closed) {
          timer = setTimeout(poll, POLL_MS);
        }
      }

      // First poll immediately so the stream flushes the catch-up window the
      // moment it opens — the client sees messages instantly, not after 2s.
      void poll();

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
