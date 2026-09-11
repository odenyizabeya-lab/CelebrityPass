import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId, isAdminAuthed } from "@/lib/auth";
import { isConversationAccessible } from "@/lib/chat/access";
import { touchFanPresence, touchTeamPresence } from "@/lib/chat/presence";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, { params }: Ctx) {
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

  const celebrity = await prisma.celebrity.findUnique({
    where: { id: conversation.celebrityId },
    select: {
      id: true,
      slug: true,
      name: true,
      profession: true,
      profileImage: true,
      isVerified: true,
      chatAccountType: true,
      chatAccountLabel: true,
      chatLastSeenAt: true,
    },
  });
  if (!celebrity) {
    return NextResponse.json({ error: "Celebrity not found" }, { status: 404 });
  }

  if (fanId) touchFanPresence(fanId).catch(() => {});
  else touchTeamPresence(celebrity.id).catch(() => {});

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const online = !!(celebrity.chatLastSeenAt && celebrity.chatLastSeenAt > fiveMinAgo);

  const readState = await prisma.chatReadState.findUnique({
    where: { conversationId },
  });

  let premiumUnlocked = true;
  if (fanId) {
    const cards = await prisma.fanCard.findMany({
      where: {
        fanId,
        celebrityId: celebrity.id,
        status: "ACTIVE",
        membershipLevel: { price: { gt: 0 } },
      },
      take: 1,
      select: { id: true },
    });
    premiumUnlocked = cards.length > 0;
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      celebrityId: conversation.celebrityId,
      status: conversation.status,
      muted: conversation.mutedByFan,
      pinned: conversation.pinnedByFan,
    },
    celebrity: {
      id: celebrity.id,
      slug: celebrity.slug,
      name: celebrity.name,
      profession: celebrity.profession,
      profileImage: celebrity.profileImage,
      isVerified: celebrity.isVerified,
      chatAccountType: celebrity.chatAccountType,
      chatAccountLabel: celebrity.chatAccountLabel,
      online,
    },
    premium: { unlocked: premiumUnlocked },
    readState: {
      fanLastReadAt: readState?.fanLastReadAt ?? null,
      teamLastReadAt: readState?.teamLastReadAt ?? null,
    },
  });
}