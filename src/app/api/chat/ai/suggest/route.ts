import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { suggestReply } from "@/lib/ai/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/chat/ai/suggest — assistant drafts a reply to the fan's latest
// message. The team reviews/edits/approves it in the chat room; this route
// never sends anything itself.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  const exists = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  try {
    const result = await suggestReply(conversationId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `AI reply failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}