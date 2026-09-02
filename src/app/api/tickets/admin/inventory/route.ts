import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { listAdminInventory } from "@/lib/ticketing/service";

export const dynamic = "force-dynamic";

// GET /api/tickets/admin/inventory?search=&status=&celebrityId= (read-only)
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const rows = await listAdminInventory({
    search: sp.get("search"),
    status: sp.get("status"),
    celebrityId: sp.get("celebrityId"),
  });
  return NextResponse.json({
    inventory: rows.map((r) => ({
      id: r.id,
      eventId: r.event.eventId,
      eventName: r.event.name,
      eventStatus: r.event.status,
      celebrityName: r.event.celebrity.name,
      name: r.name,
      category: r.category,
      priceCents: r.priceCents,
      feesCents: r.feesCents,
      currency: r.currency,
      quantityAvailable: r.quantityAvailable,
      quantityTotal: r.quantityTotal,
      status: r.status,
      sourceName: r.source?.name ?? null,
      lastSyncedAt: r.lastSyncedAt,
    })),
  });
}