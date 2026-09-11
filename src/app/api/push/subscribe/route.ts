import { NextResponse } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { vapidSupported } from "@/lib/chat/push";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!vapidSupported()) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const sub = body?.subscription;
  if (
    !sub ||
    typeof sub.endpoint !== "string" ||
    !sub.keys ||
    typeof sub.keys.p256dh !== "string" ||
    typeof sub.keys.auth !== "string"
  ) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  if (sub.endpoint.length > 2048 || sub.keys.p256dh.length > 4096 || sub.keys.auth.length > 512) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const userAgent = typeof body.userAgent === "string" ? body.userAgent.slice(0, 500) : null;

  try {
    const saved = await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        fanId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
      },
      update: { fanId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    });
    return NextResponse.json({ ok: true, id: saved.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save subscription" }, { status: 500 });
  }
}