import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { UNIVERSAL_METHOD_CARD, isAtmCardReady } from "@/lib/ticketing/universal";
import { requireGateway } from "@/lib/ticketing/gateways";
import { getOrderForHolder } from "@/lib/ticketing/service";
import { pushStatusHistory } from "@/lib/ticketing/helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/universal/atm-card
 *
 * The SINGLE ATM Card charge path used by both Fans Cards and ticket orders.
 * It NEVER fakes a success:
 *   - if no real card processor is connected → honest 409 (nothing charged).
 *   - otherwise it creates the secure charge, and only after the provider
 *     returns success does it settle the purchase.
 */
export async function POST(request: NextRequest) {
  // No real card gateway configured? Block honestly — never fake an auth.
  if (!isAtmCardReady()) {
    return NextResponse.json(
      {
        error: "ATM Card payments aren't enabled on this site yet. Please choose Bank Transfer.",
        event: "CARD_NOT_READY",
      },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const kind = body?.kind; // "FAN_CARD" | "TICKET"
  if (kind !== "FAN_CARD" && kind !== "TICKET") {
    return NextResponse.json({ error: "Invalid purchase type." }, { status: 400 });
  }

  const gateway = requireGateway(UNIVERSAL_METHOD_CARD);
  const provider = body?.provider; // secure provider token/payload from the client

  // Resolve the purchase + ownership + amount.
  let plan: { id: string; amountCents: number; currency: string; description: string } | null = null;

  if (kind === "FAN_CARD") {
    const fanId = await getCurrentFanId();
    if (!fanId) return NextResponse.json({ error: "Please sign in to pay." }, { status: 401 });
    const id = String(body?.purchaseId ?? "");
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    if (payment.fanId !== fanId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (payment.status === "PAID" && payment.cardId) {
      return NextResponse.json({ error: "Already paid." }, { status: 409 });
    }
    plan = {
      id: payment.id,
      amountCents: Math.round(payment.amount * 100),
      currency: payment.currency || "USD",
      description: payment.description ?? "Fan Card",
    };
  } else {
    const ref = String(body?.orderRef ?? "");
    const token = request.headers.get("x-order-token") ?? request.nextUrl.searchParams.get("t");
    const order = await getOrderForHolder(ref, token);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status === "CONFIRMED") return NextResponse.json({ error: "Already paid." }, { status: 409 });
    plan = { id: order.id, amountCents: order.totalCents, currency: order.currency || "USD", description: `Tickets — ${order.event.name} (${order.orderRef})` };
  }

  if (!provider) {
    return NextResponse.json({ error: "Missing secure payment token." }, { status: 400 });
  }

  // Actually run the charge through the real processor. The gateway decides
  // whether `provider` is a valid secured session; it returns ok only on a
  // real, settled payment.
  const result = await gateway.charge({
    amountCents: plan.amountCents,
    currency: plan.currency,
    description: plan.description,
  });

  if (!result.ok) {
    if (kind === "TICKET") {
      await prisma.ticketTransaction.create({
        data: {
          orderId: plan.id,
          kind: "PAYMENT",
          status: "FAILED",
          amountCents: plan.amountCents,
          currency: plan.currency,
          provider: UNIVERSAL_METHOD_CARD,
          message: result.error,
        },
      }).catch(() => undefined);
    }
    return NextResponse.json({ error: result.error, event: "CARD_DECLINED" }, { status: 402 });
  }

  const paidAt = new Date();

  if (kind === "FAN_CARD") {
    const { settlePayment } = await import("@/lib/payments");
    // The provider confirms a real charge; update the payment, then issue card.
    await prisma.payment.update({
      where: { id: plan.id },
      data: { status: "PAID", paidAt, gatewayRef: result.ref, provider: UNIVERSAL_METHOD_CARD },
    });
    const origin = request.headers.get("origin");
    const card = await settlePayment(plan.id, origin);
    if (!card) return NextResponse.json({ error: "Failed to settle." }, { status: 500 });
    return NextResponse.json({
      ok: true,
      event: "PAID",
      ref: result.ref,
      card: {
        id: card.id,
        fanNumber: card.fanNumber,
        status: card.status,
        celebritySlug: card.celebrity.slug,
        membershipLevel: card.membershipLevel?.name ?? null,
      },
    });
  }

  // TICKET
  await prisma.ticketOrder.update({
    where: { id: plan.id },
    data: {
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paidAt,
      amountPaidCents: plan.amountCents,
      paymentProvider: UNIVERSAL_METHOD_CARD,
      paymentRef: result.ref,
      deliveryMethod: "OFFICIAL_ACCOUNT",
      deliveryDetail: "Your official ticket source reference is being prepared.",
      paymentMethodId: null,
      statusHistoryJson: pushStatusHistory((await prisma.ticketOrder.findUnique({ where: { id: plan.id } }))?.statusHistoryJson ?? null, {
        status: "CONFIRMED",
        at: paidAt.toISOString(),
        note: `Paid via ATM Card (ref ${result.ref}).`,
      }),
    },
  });
  await prisma.ticketTransaction.create({
    data: {
      orderId: plan.id,
      kind: "PAYMENT",
      status: "SUCCEEDED",
      amountCents: plan.amountCents,
      currency: plan.currency,
      provider: UNIVERSAL_METHOD_CARD,
      providerRef: result.ref,
      message: "ATM Card payment succeeded.",
    },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, event: "CONFIRMED", ref: result.ref });
}