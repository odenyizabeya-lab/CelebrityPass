import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { isConversationAccessible } from "@/lib/chat/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const conversationId = String(body?.conversationId ?? "");
  const messageId = body?.messageId ? String(body.messageId) : null;
  const reason = String(body?.reason ?? "other");
  const details = body?.details ? String(body.details).slice(0, 1000) : null;

  if (!conversationId || !reason) {
    return NextResponse.json({ error: "conversationId and reason required" }, { status: 400 });
  }

  const { accessible } = await isConversationAccessible(conversationId, "fan", fanId);
  if (!accessible) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (messageId) {
    const msg = await prisma.chatMessage.findFirst({
      where: { id: messageId, conversationId },
      select: { id: true },
    });
    if (!msg) {
      return NextResponse.json({ error: "Message not found in conversation" }, { status: 404 });
    }
  }

  await prisma.messageReport.create({
    data: {
      conversationId,
      messageId,
      reporterFanId: fanId,
      reason,
      details,
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}