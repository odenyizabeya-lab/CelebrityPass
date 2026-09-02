import { NextResponse, type NextRequest } from "next/server";
import { getEventTicketView } from "@/lib/ticketing/service";

export const dynamic = "force-dynamic";

// GET /api/tickets?eventId=evt_... — public, read-only inventory for an event.
// Only fields the ticket provider authorizes are returned.
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  const view = await getEventTicketView(eventId);
  if (!view) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  return NextResponse.json({
    event: { eventId: view.event.eventId, name: view.event.name, status: view.eventStatus },
    buyable: view.buyable,
    tickets: view.tickets,
    lastSyncedAt: view.ticketLastSyncedAt,
  });
}