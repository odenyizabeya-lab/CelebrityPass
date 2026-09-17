import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentAdminEmail } from "@/lib/auth";
import { CHAT_ACCESS_OFF_DEFAULT_MESSAGE } from "@/lib/chat/constants";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ celebrityId: string }> };

/**
 * PATCH — per-celebrity Chat Access switch + optional lock message.
 *   { "chatAccessEnabled": false }                     → close chat for every fan
 *   { "chatAccessEnabled": false, "chatAccessOffMessage": "..." } → close + customize message
 *   { "chatAccessEnabled": true }                      → re-open chat (history preserved)
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const { celebrityId } = await params;
  const teamEmail = await getCurrentAdminEmail();
  if (!teamEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (typeof body.chatAccessEnabled !== "boolean") {
    return NextResponse.json(
      { error: "chatAccessEnabled (boolean) is required" },
      { status: 400 },
    );
  }

  let chatAccessOffMessage: string | null | undefined;
  if (body.chatAccessOffMessage !== undefined) {
    const msg = String(body.chatAccessOffMessage).trim();
    if (msg.length === 0) {
      return NextResponse.json(
        { error: "chatAccessOffMessage cannot be empty" },
        { status: 400 },
      );
    }
    if (msg.length > 300) {
      return NextResponse.json(
        { error: "chatAccessOffMessage must be 300 characters or fewer" },
        { status: 400 },
      );
    }
    chatAccessOffMessage = msg;
  }

  const celebrity = await prisma.celebrity.update({
    where: { id: celebrityId },
    data: {
      chatAccessEnabled: body.chatAccessEnabled,
      ...(chatAccessOffMessage !== undefined ? { chatAccessOffMessage } : {}),
    },
    select: {
      id: true,
      chatAccessEnabled: true,
      chatAccessOffMessage: true,
    },
  });

  return NextResponse.json({
    ok: true,
    celebrityId,
    chatAccessEnabled: celebrity.chatAccessEnabled,
    chatAccessOffMessage:
      celebrity.chatAccessOffMessage ?? CHAT_ACCESS_OFF_DEFAULT_MESSAGE,
  });
}