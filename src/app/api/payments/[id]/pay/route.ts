import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { getPaymentProvider, settlePayment, validateCardDetails, type CardDetails } from "@/lib/payments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/payments/[id]/pay — authorize the card and settle the payment.
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in to complete your purchase" }, { status: 401 });

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (payment.fanId !== fanId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Already settled — return the card (idempotent).
  if (payment.status === "PAID" && payment.cardId) {
    const card = await prisma.fanCard.findUnique({
      where: { id: payment.cardId },
      include: { celebrity: true, fan: true, membershipLevel: true },
    });
    return NextResponse.json({ card });
  }

  const body = await request.json().catch(() => null);
  const card = body?.card as CardDetails | undefined;
  if (!card) return NextResponse.json({ error: "Card details are required" }, { status: 400 });

  const validationError = validateCardDetails(card);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const provider = getPaymentProvider();
  const charge = await provider.charge({
    amount: payment.amount,
    currency: payment.currency,
    description: payment.description ?? "Fan card membership",
    card,
  });

  if (!charge.ok) {
    const failed = await prisma.payment.update({ where: { id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: charge.error, status: failed.status }, { status: 402 });
  }

  const settled = await prisma.payment.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date(), gatewayRef: charge.ref },
  });

  const origin =
    request.headers.get("origin") ??
    request.headers.get("x-forwarded-proto") + "://" + (request.headers.get("x-forwarded-host") ?? "localhost:3000");
  const cardRow = await settlePayment(settled.id, origin);

  if (!cardRow) return NextResponse.json({ error: "Failed to settle payment" }, { status: 500 });

  return NextResponse.json({ card: serializeCard(cardRow) });
}

function serializeCard(card: {
  id: string;
  fanNumber: string;
  status: string;
  registeredAt: Date;
  cardUrl: string | null;
  qrCode: string | null;
  celebrity: { slug: string };
  fan: { name: string };
  membershipLevel: { name: string } | null;
}) {
  return {
    id: card.id,
    fanNumber: card.fanNumber,
    status: card.status,
    registeredAt: card.registeredAt,
    cardUrl: card.cardUrl,
    qrCode: card.qrCode,
    celebritySlug: card.celebrity.slug,
    membershipLevel: card.membershipLevel?.name ?? null,
  };
}