import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { isConversationAccessible } from "@/lib/chat/access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ conversationId: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { conversationId } = await params;
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accessible } = await isConversationAccessible(conversationId, "fan", fanId);
  if (!accessible) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { mutedByFan: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const updated = await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { mutedByFan: !conversation.mutedByFan },
    select: { mutedByFan: true },
  });

  return NextResponse.json({ muted: updated.mutedByFan });
}