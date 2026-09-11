import { NextResponse } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { getVapidKeys, vapidSupported } from "@/lib/chat/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!vapidSupported()) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }
  return NextResponse.json({ publicKey: getVapidKeys().publicKey });
}