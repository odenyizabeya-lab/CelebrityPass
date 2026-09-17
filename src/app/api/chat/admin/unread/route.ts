import { NextResponse } from "next/server";
import { getCurrentAdminEmail } from "@/lib/auth";
import { getAdminUnreadTotal } from "@/lib/chat/admin-list";

export const dynamic = "force-dynamic";

export async function GET() {
  const teamEmail = await getCurrentAdminEmail();
  if (!teamEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const unread = await getAdminUnreadTotal();
  return NextResponse.json({ unread });
}