import { NextResponse, type NextRequest } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PREF_KEYS = ["notifyNewCelebrities", "notifyUpdates", "notifyCommunity", "notifyPromotions"] as const;

export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const fan = await prisma.fan.findUnique({
    where: { id: fanId },
    select: {
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: true,
      notifyNewCelebrities: true,
      notifyUpdates: true,
      notifyCommunity: true,
      notifyPromotions: true,
      unsubscribedAt: true,
    },
  });
  if (!fan || !fan.isActive) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  return NextResponse.json({ preferences: fan });
}

/**
 * Update notification preferences. Turning ANY category back on re-subscribes
 * the fan (clears the one-click unsubscribed flag).
 */
export async function PATCH(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  for (const key of PREF_KEYS) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const reopted = Object.values(data).some(Boolean);
  if (reopted) {
    data.unsubscribedAt = null;
  } else {
    data.unsubscribedAt = new Date();
  }

  const fan = await prisma.fan.update({
    where: { id: fanId },
    data: data as never,
    select: {
      emailVerified: true,
      emailVerifiedAt: true,
      notifyNewCelebrities: true,
      notifyUpdates: true,
      notifyCommunity: true,
      notifyPromotions: true,
      unsubscribedAt: true,
    },
  });

  return NextResponse.json({ ok: true, preferences: fan });
}