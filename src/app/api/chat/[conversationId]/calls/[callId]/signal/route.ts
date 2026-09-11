import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId, getCurrentAdminEmail } from "@/lib/auth";
import { isConversationAccessible } from "@/lib/chat/access";
import { touchFanPresence, touchTeamPresence } from "@/lib/chat/presence";

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
  const body = await request.json().catch(() => null);
  const type = String(body?.type ?? "");
  const payload = typeof body?.payload === "string" ? body.payload.slice(0, 16_000) : null;

  if (!["answer", "ice", "cancel", "reject", "end"].includes(type)) {
    return NextResponse.json({ error: "Invalid signal type" }, { status: 400 });
  }

  const resolved = await resolveActor(conversationId, callId);
  if ("error" in resolved) return resolved.error;
  if (!resolved.call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  await prisma.chatCallSignal.create({
    data: { callId, from: resolved.side, type, payload },
  });

  if (type === "answer") {
    await prisma.chatCall.update({ where: { id: callId }, data: { status: "ACTIVE" } });
  } else if (type === "end" || type === "reject" || type === "cancel") {
    await prisma.chatCall.update({
      where: { id: callId },
      data: {
        status: type === "end" ? "ENDED" : type === "cancel" ? "MISSED" : "DECLINED",
        endedAt: new Date(),
      },
    });
  }

  if (resolved.side === "fan") touchFanPresence(resolved.actorId).catch(() => {});
  else touchTeamPresence(conversationId).catch(() => {});

  return NextResponse.json({ ok: true });
}