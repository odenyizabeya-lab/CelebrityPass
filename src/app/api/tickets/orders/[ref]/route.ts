import { NextResponse, type NextRequest } from "next/server";
import { getOrderForHolder, orderPublicView } from "@/lib/ticketing/service";

export const dynamic = "force-dynamic";

function holderToken(request: NextRequest): string | null {
  const t = request.nextUrl.searchParams.get("t");
  if (t) return t;
  const header = request.headers.get("x-order-token");
  return header;
}

// GET /api/tickets/orders/[ref] — order detail for the holder (access token)
// or a safe summary when no token is provided.
export async function GET(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const token = holderToken(request);

  if (!token) {
    const safe = await getOrderSafe(ref);
    return NextResponse.json(safe ? { order: safe } : { error: "Order not found" }, { status: safe ? 200 : 404 });
  }

  const order = await getOrderForHolder(ref, token);
  if (!order) return NextResponse.json({ error: "Order not found or not authorized" }, { status: 404 });
  return NextResponse.json({ order });
}

async function getOrderSafe(ref: string) {
  const { prisma } = await import("@/lib/db");
  const order = await prisma.ticketOrder.findUnique({
    where: { orderRef: ref },
    include: {
      items: { select: { ticketName: true, category: true, quantity: true, unitPriceCents: true, subtotalCents: true, currency: true } },
      event: { select: { eventId: true, name: true, celebrity: { select: { slug: true, name: true } } } },
      paymentMethod: { select: { name: true } },
    },
  });
  if (!order) return null;
  return orderPublicView(order);
}