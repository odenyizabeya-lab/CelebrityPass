import { NextResponse } from "next/server";
import { clearFanSession, getCurrentFanId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearFanSession();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ fan: null });
  const fan = await prisma.fan.findUnique({
    where: { id: fanId },
    include: {
      cards: {
        include: { celebrity: true, membershipLevel: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!fan || !fan.isActive) {
    await clearFanSession();
    return NextResponse.json({ fan: null });
  }
  const { password: _password, ...safeFan } = fan;
  return NextResponse.json({ fan: safeFan });
}