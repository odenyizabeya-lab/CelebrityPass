import { NextResponse } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { getFanUnreadTotal } from "@/lib/chat/list";
import { touchFanPresence } from "@/lib/chat/presence";

export const dynamic = "force-dynamic";

export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  touchFanPresence(fanId).catch(() => {});
  const unread = await getFanUnreadTotal(fanId);
  return NextResponse.json({ unread });
}