// POST /api/tickets/orders/[ref]/flutterwave
//
// Create the Flutterwave V3 hosted checkout (Standard flow) for a TICKET order,
// store the stable tx_ref in `paymentRef`, and redirect the customer to
// Flutterwave's page. Card data NEVER reaches this server — Flutterwave
// collects it on their own hosted page.
//
// Settlement is done ONLY by the /api/payments/flutterwave/webhook route after a
// server-side GET /transactions/{id}/verify re-check (see its ticket branch).
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/utils";
import { getOrderForHolder } from "@/lib/ticketing/service";
import { pushStatusHistory } from "@/lib/ticketing/helpers";
import {
  createFlutterwaveHostedCheckout,
  getFlutterwaveConfig,
  isFlutterwaveReady,
} from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const token = request.headers.get("x-order-token") ?? request.nextUrl.searchParams.get("t");
  const order = await getOrderForHolder(ref, token);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (order.status === "CONFIRMED") {
    return NextResponse.json({ ok: true, alreadyPaid: true, redirectUrl: `/order/${order.orderRef}?t=${order.accessToken}` });
  }
  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    return NextResponse.json({ error: "This order is closed." }, { status: 409 });
  }
  if (!Number.isFinite(order.totalCents) || order.totalCents <= 0) {
    return NextResponse.json({ error: "This order has no amount to charge." }, { status: 400 });
  }

  const config = await getFlutterwaveConfig();
  if (!isFlutterwaveReady(config)) {
    return NextResponse.json({ error: "Card payments aren't enabled on this site yet. Please use Bank Transfer." }, { status: 400 });
  }

  // V3 `tx_ref` must be unique per transaction and stable across retries so the
  // webhook can always find this order and retries never create a duplicate.
  const txRef = `CP-${order.id}`;
  const redirectUrl = `${appUrl()}/api/tickets/flutterwave/callback?ref=${encodeURIComponent(order.orderRef)}&t=${encodeURIComponent(order.accessToken)}`;

  const result = await createFlutterwaveHostedCheckout({
    txRef,
    amount: order.totalCents / 100,
    currency: order.currency || "USD",
    redirectUrl,
    customer: {
      name: order.customerName || "Guest",
      email: order.customerEmail || "",
    },
    title: `Tickets — ${order.event.name}`,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Persist the provider reference BEFORE the customer is redirected so the
  // webhook can always find this order.
  await prisma.ticketOrder.update({
    where: { id: order.id },
    data: {
      status: "PAYMENT_PROCESSING",
      paymentStatus: "PROCESSING",
      paymentRef: txRef,
      statusHistoryJson: pushStatusHistory(order.statusHistoryJson, { status: "PAYMENT_PROCESSING", at: new Date().toISOString(), note: "Redirected to secure card payment." }),
    },
  });

  return NextResponse.json({
    ok: true,
    link: result.link,
    txRef,
    status: result.status,
  });
}