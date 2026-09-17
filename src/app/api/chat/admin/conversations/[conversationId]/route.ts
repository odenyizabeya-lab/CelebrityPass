import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentAdminEmail } from "@/lib/auth";
import { celebrityImageFlags } from "@/lib/images";
import { CHAT_ACCESS_OFF_DEFAULT_MESSAGE, AI_MODE_AUTO, AI_MODE_MANUAL } from "@/lib/chat/constants";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ conversationId: string }> };

/** Full conversation detail for the admin chat room (one round trip). */
export async function GET(_request: Request, { params }: Ctx) {
  const { conversationId } = await params;
  const teamEmail = await getCurrentAdminEmail();
  if (!teamEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      fan: {
        select: {
          id: true,
          name: true,
          email: true,
          country: true,
          isActive: true,
          lastSeenAt: true,
        },
      },
      celebrity: {
        select: {
          id: true,
          slug: true,
          name: true,
          profession: true,
          accentColor: true,
          isVerified: true,
          chatAccountType: true,
          chatAccountLabel: true,
          chatLastSeenAt: true,
          chatAccessEnabled: true,
          chatAccessOffMessage: true,
        },
      },
    },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const cards = await prisma.fanCard.findMany({
    where: {
      fanId: conversation.fanId,
      celebrityId: conversation.celebrityId,
      status: "ACTIVE",
    },
    take: 1,
    select: { id: true },
  });

  const readState = await prisma.chatReadState.findUnique({
    where: { conversationId },
    select: { fanLastReadAt: true, teamLastReadAt: true },
  });

  const imageFlags = await celebrityImageFlags();
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const fanOnline =
    !!conversation.fan.lastSeenAt &&
    new Date(conversation.fan.lastSeenAt).getTime() > fiveMinAgo;
  const celebOnline =
    !!conversation.celebrity.chatLastSeenAt &&
    new Date(conversation.celebrity.chatLastSeenAt).getTime() > fiveMinAgo;

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      fanId: conversation.fanId,
      celebrityId: conversation.celebrityId,
      status: conversation.status,
      aiMode: conversation.aiMode === AI_MODE_MANUAL ? AI_MODE_MANUAL : AI_MODE_AUTO,
      lastMessageAt: conversation.lastMessageAt ?? null,
    },
    fan: {
      id: conversation.fan.id,
      name: conversation.fan.name,
      email: conversation.fan.email,
      country: conversation.fan.country,
      isActive: conversation.fan.isActive,
      isOnline: fanOnline,
      lastSeenAt: conversation.fan.lastSeenAt
        ? conversation.fan.lastSeenAt.toISOString()
        : null,
      hasPass: cards.length > 0,
    },
    celebrity: {
      id: conversation.celebrity.id,
      slug: conversation.celebrity.slug,
      name: conversation.celebrity.name,
      profession: conversation.celebrity.profession,
      accentColor: conversation.celebrity.accentColor,
      profileImage: imageFlags.get(conversation.celebrity.slug)?.hasProfile
        ? `/images/${conversation.celebrity.slug}/profile`
        : null,
      isVerified: conversation.celebrity.isVerified,
      chatAccountType: conversation.celebrity.chatAccountType,
      chatAccountLabel: conversation.celebrity.chatAccountLabel,
      isOnline: celebOnline,
      chatAccessEnabled: conversation.celebrity.chatAccessEnabled,
      chatAccessOffMessage:
        conversation.celebrity.chatAccessOffMessage ??
        CHAT_ACCESS_OFF_DEFAULT_MESSAGE,
    },
    readState: {
      fanLastReadAt: readState?.fanLastReadAt ?? null,
      teamLastReadAt: readState?.teamLastReadAt ?? null,
    },
  });
}

/**
 * PATCH — per-conversation AI reply mode.
 *   { "aiMode": "manual" }  → admin "Took over chat" (AI replies OFF, this chat only)
 *   { "aiMode": "auto" }    → "Return to AI" (AI may reply again)
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const { conversationId } = await params;
  const teamEmail = await getCurrentAdminEmail();
  if (!teamEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const aiMode = String(body?.aiMode ?? "");
  if (aiMode !== AI_MODE_AUTO && aiMode !== AI_MODE_MANUAL) {
    return NextResponse.json({ error: "aiMode must be 'auto' or 'manual'" }, { status: 400 });
  }

  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { aiMode },
  });

  return NextResponse.json({ ok: true, conversationId, aiMode });
}