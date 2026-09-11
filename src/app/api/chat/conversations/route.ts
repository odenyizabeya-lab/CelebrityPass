import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { canFanSendMessage, getOrCreateConversation } from "@/lib/chat/access";
import { touchFanPresence } from "@/lib/chat/presence";
import { listFanConversations } from "@/lib/chat/list";

export const dynamic = "force-dynamic";

export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  touchFanPresence(fanId).catch(() => {});

  const conversations = await listFanConversations(fanId);
  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const celebrityId = String(body?.celebrityId ?? "");
  if (!celebrityId) {
    return NextResponse.json({ error: "celebrityId required" }, { status: 400 });
  }

  const celebrity = await prisma.celebrity.findUnique({
    where: { id: celebrityId },
    select: { id: true, isActive: true },
  });
  if (!celebrity || !celebrity.isActive) {
    return NextResponse.json({ error: "Celebrity not found" }, { status: 404 });
  }

  const { allowed, reason } = await canFanSendMessage(fanId, celebrityId);
  if (!allowed) {
    return NextResponse.json(
      { error: reason ?? "Not allowed to chat with this celebrity" },
      { status: 403 },
    );
  }

  const conversation = await getOrCreateConversation(fanId, celebrityId);
  touchFanPresence(fanId).catch(() => {});
  return NextResponse.json({ conversation });
}