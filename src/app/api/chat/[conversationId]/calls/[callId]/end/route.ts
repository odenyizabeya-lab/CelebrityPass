import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId, getCurrentAdminEmail } from "@/lib/auth";
import { isConversationAccessible } from "@/lib/chat/access";
import { touchFanPresence } from "@/lib/chat/presence";
import { sendMessage } from "@/lib/chat/messages";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ conversationId: string; callId: string }> };

async function resolveActor(conversationId: string, callId: string) {
  const fanId = await getCurrentFanId();
  if (fanId) {
    const { accessible } = await isConversationAccessible(conversationId, "fan", fanId);
    if (!accessible) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { side: "fan" as const, actorId: fanId, call: await prisma.chatCall.findFirst({ where: { id: callId, conversationId } }) };
  }
  const teamEmail = await getCurrentAdminEmail();
  if (teamEmail) {
    const { accessible } = await isConversationAccessible(conversationId, "team", teamEmail);
    if (!accessible) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { side: "team" as const, actorId: teamEmail, call: await prisma.chatCall.findFirst({ where: { id: callId, conversationId } }) };
  }
  return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}

export async function POST(request: Request, { params }: Ctx) {
  const { conversationId, callId } = await params;
  const resolved = await resolveActor(conversationId, callId);
  if ("error" in resolved) return resolved.error;
  if (!resolved.call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  await prisma.chatCall.update({
    where: { id: callId },
    data: { status: "ENDED", endedAt: new Date() },
  });

  // Insert a "call" record message so both sides see it in the transcript.
  const label = resolved.call.mode === "video" ? "Video call" : "Voice call";
  try {
    await sendMessage({
      conversationId,
      senderType: "system",
      clientId: `call-${callId}`,
      type: "call",
      body: `Call ended (${label})`,
    });
  } catch {}

  touchFanPresence(resolved.actorId).catch(() => {});
  return NextResponse.json({ ok: true });
}