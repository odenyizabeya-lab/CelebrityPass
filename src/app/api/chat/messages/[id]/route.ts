import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId, isAdminAuthed } from "@/lib/auth";
import { isConversationAccessible } from "@/lib/chat/access";
import { editMessage, deleteMessage } from "@/lib/chat/messages";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function resolveActor() {
  const fanId = await getCurrentFanId();
  if (fanId) return { type: "fan" as const, id: fanId };
  const isTeam = await isAdminAuthed();
  if (isTeam) return { type: "team" as const, id: "admin" };
  return null;
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const actor = await resolveActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const newBody = String(body?.body ?? "").trim();
  if (!newBody) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const message = await prisma.chatMessage.findUnique({ where: { id } });
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const { accessible } = await isConversationAccessible(
    message.conversationId,
    actor.type,
    actor.id,
  );
  if (!accessible) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await editMessage(id, actor.type, actor.id, newBody);
  if (!updated) {
    return NextResponse.json(
      { error: "Message can no longer be edited" },
      { status: 400 },
    );
  }
  return NextResponse.json({ message: updated });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const actor = await resolveActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const message = await prisma.chatMessage.findUnique({ where: { id } });
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const { accessible } = await isConversationAccessible(
    message.conversationId,
    actor.type,
    actor.id,
  );
  if (!accessible) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ok = await deleteMessage(id, actor.type, actor.id);
  if (!ok) {
    return NextResponse.json({ error: "Cannot delete this message" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}