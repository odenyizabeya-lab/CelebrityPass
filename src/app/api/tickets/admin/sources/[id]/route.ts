import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH /api/tickets/admin/sources/[id] — toggle ticket sync for a source.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body?.supportsTickets === undefined) return NextResponse.json({ error: "supportsTickets is required" }, { status: 400 });

  const existing = await prisma.eventSource.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  // Only provider-backed sources can be ticket sources.
  if (Boolean(body.supportsTickets) && existing.key === "admin") {
    return NextResponse.json({ error: "The manual admin source cannot supply ticket inventory." }, { status: 400 });
  }

  const source = await prisma.eventSource.update({ where: { id }, data: { supportsTickets: Boolean(body.supportsTickets) } });
  return NextResponse.json({ source });
}