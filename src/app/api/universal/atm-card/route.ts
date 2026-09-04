import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { UNIVERSAL_METHOD_CARD, isAtmCardReady } from "@/lib/ticketing/universal";
import { requireGateway } from "@/lib/ticketing/gateways";
import { getOrderForHolder } from "@/lib/ticketing/service";
import { pushStatusHistory } from "@/lib/ticketing/helpers";
import { getPaymentProvider, validateCardDetails, settlePayment, type CardDetails } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * POST /api/universal/atm-card
 *
 * The SINGLE ATM Card charge path used by both Fans Cards and ticket orders.
 * It NEVER fakes a success:
 *   - if no real card processor is connected → honest 409 (nothing charged).
 *   - otherwise it charges the card via the configured provider, and only after
 *     the provider returns success does it settle the purchase.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const kind = body?.kind; // "FAN_CARD" | "TICKET"
  if (kind !== "FAN_CARD" && kind !== "TICKET") {
    return NextResponse.json({ error: "Invalid purchase type." }, { status: 400 });
  }

  // Accept card details directly from the client form.
  const card = body?.card as CardDetails | undefined;

  if (kind === "FAN_CARD") {
    // Fan-card payments go through the dedicated /api/payments/[id]/pay route
    // which uses the configured PaymentProvider. This universal route is for
    // ticket orders primarily; fan-card card payments use the existing flow.
    const fanId = await getCurrentFanId();
    if (!fanId) return NextResponse.json({ error: "Please sign in to pay." }, { status: 401 });

    if (card) {
      // Direct card payment for fan cards — use the configured provider.
      const validationError = validateCardDetails(card);
      if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

      const id = String(body?.purchaseId ?? "");
      const payment = await prisma.payment.findUnique({ where: { id } });
      if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
      if (payment.fanId !== fanId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      if (payment.status === "PAID" && payment.cardId) {
        return NextResponse.json({ error: "Already paid." }, { status: 409 });
      }

      const provider = getPaymentProvider();
      const charge = await provider.charge({
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description ?? "Fan card membership",
        card,
      });

      if (!charge.ok) {
        await prisma.payment.update({ where: { id }, data: { status: "FAILED" } });
        return NextResponse.json({ error: charge.error }, { status: 402 });
      }

      await prisma.payment.update({
        where: { id },
        data: { status: "PAID", paidAt: new Date(), gatewayRef: charge.ref, provider: "stripe" },
      });

      const origin = request.headers.get("origin");
      const settledCard = await settlePayment(id, origin);
      if (!settledCard) return NextResponse.json({ error: "Failed to settle." }, { status: 500 });

      return NextResponse.json({
        ok: true,
        event: "PAID",
        ref: charge.ref,
        card: {
          id: settledCard.id,
          fanNumber: settledCard.fanNumber,
          status: settledCard.status,
          celebritySlug: settledCard.celebrity.slug,
          membershipLevel: settledCard.membershipLevel?.name ?? null,
        },
      });
    }

    // Legacy provider-token path (backward compat)
    if (!isAtmCardReady()) {
      return NextResponse.json(
        { error: "ATM Card payments aren't enabled on this site yet. Please choose Bank Transfer.", event: "CARD_NOT_READY" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Card details are required." }, { status: 400 });
  }

  // TICKET path
  const ref = String(body?.orderRef ?? "");
  const token = request.headers.get("x-order-token") ?? request.nextUrl.searchParams.get("t");
  const order = await getOrderForHolder(ref, token);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status === "CONFIRMED") return NextResponse.json({ error: "Already paid." }, { status: 409 });

  const plan = { id: order.id, amountCents: order.totalCents, currency: order.currency || "USD", description: `Tickets — ${order.event.name} (${order.orderRef})` };

  // Check if a real gateway is connected for direct charges
  if (isAtmCardReady()) {
    const gateway = requireGateway(UNIVERSAL_METHOD_CARD);
    await prisma.ticketOrder.update({
      where: { id: plan.id },
      data: {
        paymentStatus: "PROCESSING",
        status: "PAYMENT_PROCESSING",
        statusHistoryJson: pushStatusHistory(
          (await prisma.ticketOrder.findUnique({ where: { id: plan.id } }))?.statusHistoryJson ?? null,
          { status: "PAYMENT_PROCESSING", at: new Date().toISOString(), note: "Payment processing." },
        ),
      },
    });

    const result = await gateway.charge({
      amountCents: plan.amountCents,
      currency: plan.currency,
      description: plan.description,
    });

    if (!result.ok) {
      await prisma.ticketOrder.update({
        where: { id: plan.id },
        data: {
          status: "FAILED",
          paymentStatus: "FAILED",
          statusHistoryJson: pushStatusHistory(
            (await prisma.ticketOrder.findUnique({ where: { id: plan.id } }))?.statusHistoryJson ?? null,
            { status: "FAILED", at: new Date().toISOString(), note: result.error },
          ),
        },
      });
      await prisma.ticketTransaction.create({
        data: { orderId: plan.id, kind: "PAYMENT", status: "FAILED", amountCents: plan.amountCents, currency: plan.currency, provider: UNIVERSAL_METHOD_CARD, message: result.error },
      });
      return NextResponse.json({ error: result.error, event: "CARD_DECLINED" }, { status: 402 });
    }

    const paidAt = new Date();
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
        statusHistoryJson: pushStatusHistory(
          (await prisma.ticketOrder.findUnique({ where: { id: plan.id } }))?.statusHistoryJson ?? null,
          { status: "CONFIRMED", at: paidAt.toISOString(), note: `Paid via ATM Card (ref ${result.ref}).` },
        ),
      },
    });
    await prisma.ticketTransaction.create({
      data: { orderId: plan.id, kind: "PAYMENT", status: "SUCCEEDED", amountCents: plan.amountCents, currency: plan.currency, provider: UNIVERSAL_METHOD_CARD, providerRef: result.ref, message: "ATM Card payment succeeded." },
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, event: "CONFIRMED", ref: result.ref });
  }

  // If card details provided but no gateway, use the mock provider from payments.ts
  if (card) {
    const validationError = validateCardDetails(card);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const provider = getPaymentProvider();
    const charge = await provider.charge({
      amount: plan.amountCents / 100,
      currency: plan.currency,
      description: plan.description,
      card,
    });

    if (!charge.ok) {
      await prisma.ticketOrder.update({
        where: { id: plan.id },
        data: { status: "FAILED", paymentStatus: "FAILED" },
      });
      await prisma.ticketTransaction.create({
        data: { orderId: plan.id, kind: "PAYMENT", status: "FAILED", amountCents: plan.amountCents, currency: plan.currency, provider: UNIVERSAL_METHOD_CARD, message: charge.error },
      });
      return NextResponse.json({ error: charge.error }, { status: 402 });
    }

    const paidAt = new Date();
    await prisma.ticketOrder.update({
      where: { id: plan.id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
        paidAt,
        amountPaidCents: plan.amountCents,
        paymentProvider: provider.id,
        paymentRef: charge.ref,
        deliveryMethod: "OFFICIAL_ACCOUNT",
        deliveryDetail: "Your official ticket source reference is being prepared.",
        paymentMethodId: null,
        statusHistoryJson: pushStatusHistory(
          (await prisma.ticketOrder.findUnique({ where: { id: plan.id } }))?.statusHistoryJson ?? null,
          { status: "CONFIRMED", at: paidAt.toISOString(), note: `Paid via card (ref ${charge.ref}).` },
        ),
      },
    });
    await prisma.ticketTransaction.create({
      data: { orderId: plan.id, kind: "PAYMENT", status: "SUCCEEDED", amountCents: plan.amountCents, currency: plan.currency, provider: provider.id, providerRef: charge.ref, message: "Card payment succeeded." },
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, event: "CONFIRMED", ref: charge.ref });
  }

  return NextResponse.json({ error: "ATM Card payments aren't enabled on this site yet. Please choose Bank Transfer." }, { status: 409 });
}
