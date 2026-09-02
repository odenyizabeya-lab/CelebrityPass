import { NextResponse, type NextRequest } from "next/server";
import { getOrderForHolder } from "@/lib/ticketing/service";
import { buildPaymentMethods } from "@/lib/ticketing/universal";

export const dynamic = "force-dynamic";

// GET /api/tickets/orders/[ref]/methods — universal methods for a ticket order's checkout.
export async function GET(request: NextRequest, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  const token = request.headers.get("x-order-token") ?? request.nextUrl.searchParams.get("t");
  const order = await getOrderForHolder(ref, token);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (order.status === "CONFIRMED") {
    return NextResponse.json({ error: "This order is already confirmed." }, { status: 409 });
  }

  const plan = {
    kind: "TICKET" as const,
    id: order.id,
    ref: order.orderRef,
    title: `Tickets — ${order.event.name}`,
    amountCents: order.totalCents,
    currency: order.currency || "USD",
  };
  const { methods, defaultMethod } = await buildPaymentMethods(plan);
  return NextResponse.json({ methods, defaultMethod });
}