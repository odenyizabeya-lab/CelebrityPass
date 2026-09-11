import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const celebrityId = String(body?.celebrityId ?? "");
  const action = body?.action === "unblock" ? "unblock" : "block";

  if (!celebrityId) {
    return NextResponse.json({ error: "celebrityId required" }, { status: 400 });
  }

  if (action === "unblock") {
    await prisma.chatBlock.deleteMany({ where: { fanId, celebrityId } });
    return NextResponse.json({ ok: true, action: "unblocked" });
  }

  const reason = String(body?.reason ?? "none");
  const details = body?.details ? String(body.details).slice(0, 500) : null;

  await prisma.chatBlock.upsert({
    where: { fanId_celebrityId: { fanId, celebrityId } },
    create: { fanId, celebrityId, reason, details },
    update: { reason, details },
  });

  await prisma.chatReadState.updateMany({
    where: { conversation: { fanId, celebrityId } },
    data: { fanLastReadAt: new Date() },
  });

  return NextResponse.json({ ok: true, action: "blocked" });
}