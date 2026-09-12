import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId, getCurrentAdminEmail } from "@/lib/auth";
import { isConversationAccessible } from "@/lib/chat/access";
import { touchFanPresence, touchTeamPresence } from "@/lib/chat/presence";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ conversationId: string }> };

type Actor =
  | { type: "fan"; id: string }
  | { type: "team"; id: string };

async function resolveActor(conversationId: string): Promise<{ actor: Actor; conversationId: string } | { error: Response }> {
  const fanId = await getCurrentFanId();
  if (fanId) {
    const { accessible } = await isConversationAccessible(conversationId, "fan", fanId);
    if (!accessible) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { actor: { type: "fan", id: fanId }, conversationId };
  }
  const teamEmail = await getCurrentAdminEmail();
  if (teamEmail) {
    const { accessible } = await isConversationAccessible(conversationId, "team", teamEmail);
    if (!accessible) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { actor: { type: "team", id: teamEmail }, conversationId };
  }
  return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}

// GET: active calls for this conversation + signaling messages newer than `since`.
export async function GET(request: Request, { params }: Ctx) {
  const { conversationId } = await params;
  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const resolved = await resolveActor(conversationId);
  if ("error" in resolved) return resolved.error;

  let signalWhere: Record<string, unknown> = { call: { conversationId } };
  if (since) {
    const parsed = new Date(since);
    if (!isNaN(parsed.getTime())) {
      signalWhere = { ...signalWhere, createdAt: { gt: parsed } };
    } else {
      signalWhere = { ...signalWhere, id: { gt: since } };
    }
  }

  const [signals, calls] = await Promise.all([
    prisma.chatCallSignal.findMany({
      where: signalWhere,
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.chatCall.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
  ]);

  if (resolved.actor.type === "fan") touchFanPresence(resolved.actor.id).catch(() => {});
  else touchTeamPresence(conversationId).catch(() => {});

  const latestSignalId = signals.length ? signals[signals.length - 1].id : null;
  const safeCalls = calls
    .filter((c) => c.endedAt !== null || c.status === "RINGING" || c.status === "ACTIVE")
    .map((c) => ({
      id: c.id,
      conversationId: c.conversationId,
      mode: c.mode,
      status: c.status,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
    }));

  return NextResponse.json({ calls: safeCalls, signals, latestSignalId });
}

// POST: create a new call (RINGING) with an SDP offer.
export async function POST(request: Request, { params }: Ctx) {
  const { conversationId } = await params;
  const body = await request.json().catch(() => null);
  const mode = body?.mode === "video" ? "video" : "voice";
  const sdp = typeof body?.sdp === "string" ? body.sdp.slice(0, 16_000) : null;
  if (!sdp) {
    return NextResponse.json({ error: "sdp required" }, { status: 400 });
  }

  const resolved = await resolveActor(conversationId);
  if ("error" in resolved) return resolved.error;
  const actorSide = resolved.actor.type;

  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  // Chat itself is free for every logged-in fan; only voice/video calls require a
  // paid ACTIVE FanCard. Enforce that server-side so the premium gate can't be bypassed.
  if (resolved.actor.type === "fan") {
    const premiumCard = await prisma.fanCard.findFirst({
      where: {
        fanId: resolved.actor.id,
        celebrityId: conversation.celebrityId,
        status: "ACTIVE",
        membershipLevel: { price: { gt: 0 } },
      },
      select: { id: true },
    });
    if (!premiumCard) {
      return NextResponse.json(
        { error: "Voice and video calls are a premium feature. Get your Fan Card to unlock." },
        { status: 403 },
      );
    }
  }

  const existing = await prisma.chatCall.findFirst({
    where: { conversationId, status: { in: ["RINGING", "ACTIVE"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "A call is already active" }, { status: 409 });
  }

  const call = await prisma.chatCall.create({
    data: {
      conversationId,
      celebrityId: conversation.celebrityId,
      fanId: resolved.actor.type === "fan" ? resolved.actor.id : undefined,
      mode,
      createdBy: actorSide,
    },
  });

  await prisma.chatCallSignal.create({
    data: { callId: call.id, from: actorSide, type: "offer", payload: sdp },
  });

  touchFanPresence(resolved.actor.id).catch(() => {});
  return NextResponse.json({ call }, { status: 201 });
}