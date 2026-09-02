import { NextResponse, type NextRequest } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { createTicketOrder } from "@/lib/ticketing/service";

export const dynamic = "force-dynamic";

// POST /api/tickets/orders — create a real purchase intent (guest checkout).
// Returns the consumer order ref + a holder access token. No ticket or
// confirmation is produced here.
export async function POST(request: NextRequest) {
  const fanId = await getCurrentFanId();
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const eventId = String(body.eventId ?? "");
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  const items = Array.isArray(body.items)
    ? body.items.map((i: { inventoryId?: unknown; quantity?: unknown }) => ({
        inventoryId: String(i?.inventoryId ?? ""),
        quantity: Number(i?.quantity ?? 0),
      }))
    : [];

  try {
    const result = await createTicketOrder({
      eventId,
      items,
      fanId,
      customer: {
        name: String(body.customer?.name ?? ""),
        email: String(body.customer?.email ?? ""),
        phone: body.customer?.phone ? String(body.customer.phone) : null,
        country: body.customer?.country ? String(body.customer.country) : null,
      },
    });
    return NextResponse.json(
      { ok: true, orderRef: result.orderRef, token: result.accessToken },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create the order.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}