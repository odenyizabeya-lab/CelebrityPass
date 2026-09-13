import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_AI_STYLE, stylePresets } from "@/lib/ai/assistant";

export const dynamic = "force-dynamic";

// GET/POST /api/chat/ai/style — read/update the celebrity's AI reply style
// (the tone the assistant matches when drafting replies).
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const conversationId = request.nextUrl.searchParams.get("conversationId")?.trim() ?? "";
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { celebrity: { select: { name: true, chatAiStyle: true } } },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({
    style: conversation.celebrity.chatAiStyle?.trim() || null,
    celebrityName: conversation.celebrity.name,
    presets: stylePresets(),
  });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }
  const rawStyle = typeof body?.style === "string" ? body.style : DEFAULT_AI_STYLE;
  const style = rawStyle.trim().slice(0, 160) || null;

  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { celebrityId: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const updated = await prisma.celebrity.update({
    where: { id: conversation.celebrityId },
    data: { chatAiStyle: style },
    select: { chatAiStyle: true },
  });

  return NextResponse.json({ style: updated.chatAiStyle });
}