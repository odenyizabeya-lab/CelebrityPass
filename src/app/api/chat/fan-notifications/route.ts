import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { celebrityImageFlags } from "@/lib/images";

export const dynamic = "force-dynamic";

// Fan-wide notification stream. Unlike /api/chat/events (one open conversation),
// this watches every conversation belonging to the fan and emits each new team
// message the moment it lands — the in-app banner component turns those into the
// on-screen toasts fans see and tap to reply. It deliberately only emits
// messages the fan has NOT read yet and skips muted conversations, so it never
// re-notifies something already seen.
const POLL_MS = 1600;
const HEARTBEAT_MS = 20_000;
const MAX_DURATION_MS = 1_800_000; // 30 minutes per connection

const MEDIA_PREVIEW: Record<string, string> = {
  image: "Photo",
  audio: "Voice message",
  video: "Video",
  file: "Attachment",
  url: "Shared a link",
};

function previewFor(type: string, body: string | null): string {
  if (MEDIA_PREVIEW[type]) return MEDIA_PREVIEW[type];
  const text = (body ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return "Shared a link";
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

function sse(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(request: Request) {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fan = await prisma.fan.findUnique({
    where: { id: fanId },
    select: { chatNotify: true },
  });
  if (!fan) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fan switched chat notifications off entirely — tell the client to stop
  // quietly instead of reconnecting forever against an always-empty stream.
  if (fan.chatNotify === false) {
    return new Response(sse({ type: "disabled" }), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const imageFlags = await celebrityImageFlags();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let cursor: Date = new Date(Date.now() - 60_000);
      let cursorIds = new Set<string>();

      function send(event: Record<string, unknown>) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sse(event)));
        } catch {
          close();
        }
      }

      function close() {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {}
      }

      send({ type: "heartbeat" });

      heartbeatTimer = setInterval(() => {
        send({ type: "heartbeat" });
      }, HEARTBEAT_MS);

      async function poll() {
        if (closed) return;
        try {
          const rows = await prisma.$queryRaw<
            {
              id: string;
              body: string | null;
              type: string;
              createdAt: Date;
              conversationId: string;
              celebrityId: string;
              celebritySlug: string;
              celebrityName: string;
            }[]
          >`
            SELECT m."id", m."body", m."type", m."createdAt",
                   c."id"      AS "conversationId",
                   cel."id"    AS "celebrityId",
                   cel."slug"  AS "celebritySlug",
                   cel."name"  AS "celebrityName"
            FROM "ChatMessage" m
            JOIN "ChatConversation" c ON c."id" = m."conversationId"
            JOIN "Celebrity" cel ON cel."id" = c."celebrityId"
            LEFT JOIN "ChatReadState" rs ON rs."conversationId" = c."id"
            WHERE c."fanId" = ${fanId}
              AND m."senderType" <> 'fan'
              AND m."deletedAt" IS NULL
              AND c."mutedByFan" = false
              AND COALESCE(rs."fanLastReadAt", to_timestamp(0)) < m."createdAt"
              AND m."createdAt" >= ${cursor}
            ORDER BY m."createdAt" ASC, m."id" ASC
            LIMIT 100
          `;

          let streamCursor = cursor;
          let streamCursorIds = new Set<string>();
          let advanced = false;

          for (const msg of rows) {
            const boundary =
              msg.createdAt.getTime() === cursor.getTime() && cursorIds.has(msg.id);
            if (boundary) continue;

            send({
              type: "incoming",
              conversationId: msg.conversationId,
              messageId: msg.id,
              preview: previewFor(msg.type, msg.body),
              createdAt: msg.createdAt.toISOString(),
              celebrity: {
                id: msg.celebrityId,
                slug: msg.celebritySlug,
                name: msg.celebrityName,
                profileImageUrl:
                  imageFlags.get(msg.celebritySlug)?.hasProfile
                    ? `/images/${msg.celebritySlug}/profile`
                    : null,
              },
            });

            advanced = true;
            const t = msg.createdAt.getTime();
            if (t > streamCursor.getTime()) {
              streamCursor = msg.createdAt;
              streamCursorIds = new Set([msg.id]);
            } else if (t === streamCursor.getTime()) {
              streamCursorIds.add(msg.id);
            }
          }

          if (advanced) {
            cursor = streamCursor;
            cursorIds = streamCursorIds;
          }
        } catch (err) {
          console.error("fan-notifications poll error", err);
        }

        if (!closed) {
          timer = setTimeout(poll, POLL_MS);
        }
      }

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