import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/invest/notifications — the caller’s investment notifications.
export async function GET(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  const account = await prisma.investorAccount.findUnique({ where: { fanId } });
  if (!account) return NextResponse.json({ notifications: [] });

  const markRead = request.nextUrl.searchParams.get("markRead") === "1";

  if (markRead) {
    await prisma.investNotification.updateMany({
      where: { investorId: account.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  const rows = await prisma.investNotification.findMany({
    where: { investorId: account.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.readAt != null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}