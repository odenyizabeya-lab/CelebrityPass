import { NextResponse } from "next/server";
import { getCurrentFanId, isAdminAuthed } from "@/lib/auth";
import { isConversationAccessible } from "@/lib/chat/access";
import { touchFanPresence, touchTeamPresence } from "@/lib/chat/presence";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ conversationId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { conversationId } = await params;
  const body = await request.json().catch(() => null);
  const isTyping = body?.typing === false ? false : true;

  const fanId = await getCurrentFanId();
  const isTeam = fanId ? false : await isAdminAuthed();
  const actorType: "fan" | "team" | null = fanId ? "fan" : isTeam ? "team" : null;
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

  if (actorType === "fan") {
    touchFanPresence(fanId as string).catch(() => {});
  } else {
    touchTeamPresence(conversation.celebrityId).catch(() => {});
  }

  return NextResponse.json({ ok: true, typing: isTyping });
}