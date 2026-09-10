import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Fetch or cancel an announcement (cancel stops unsent messages). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await prisma.emailAnnouncement.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ announcement: row });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.emailMessage.updateMany({
    where: { announcementId: id, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "CANCELED" },
  });
  await prisma.emailAnnouncement.update({ where: { id }, data: { status: "CANCELED" } });
  return NextResponse.json({ ok: true });
}