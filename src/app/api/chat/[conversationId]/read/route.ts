import { NextResponse } from "next/server";
import { getCurrentFanId, isAdminAuthed } from "@/lib/auth";
import { isConversationAccessible } from "@/lib/chat/access";
import { markRead } from "@/lib/chat/messages";
import { touchFanPresence, touchTeamPresence } from "@/lib/chat/presence";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ conversationId: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { conversationId } = await params;
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

  await markRead(conversationId, actorType);
  if (fanId) touchFanPresence(fanId).catch(() => {});
  else touchTeamPresence(conversation.celebrityId).catch(() => {});

  return NextResponse.json({ ok: true });
}