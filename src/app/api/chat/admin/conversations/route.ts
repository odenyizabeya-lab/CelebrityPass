import { NextResponse } from "next/server";
import { getCurrentAdminEmail } from "@/lib/auth";
import { listAdminConversations } from "@/lib/chat/admin-list";

export const dynamic = "force-dynamic";

export async function GET() {
  const teamEmail = await getCurrentAdminEmail();
  if (!teamEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const conversations = await listAdminConversations();
  return NextResponse.json({ conversations });
}