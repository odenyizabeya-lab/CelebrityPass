// POST /api/payments/[id]/flutterwave — open a Flutterwave hosted payment for
// a pending fan-card payment. Returns the hosted-page link; the customer is
// redirected there and pays on Flutterwave (card details never hit our servers).
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { appUrl } from "@/lib/utils";
import { getFlutterwaveConfig, initializeFlutterwavePayment, isFlutterwaveReady } from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in to complete your purchase" }, { status: 401 });

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      fan: { select: { name: true, email: true } },
      celebrity: { select: { slug: true, name: true } },
      membershipLevel: { select: { name: true } },
    },
  });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (payment.fanId !== fanId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Already settled — idempotent.
  if (payment.status === "PAID" && payment.cardId) {
    const card = await prisma.fanCard.findUnique({ where: { id: payment.cardId } });
    if (card && payment.celebrity) {
      return NextResponse.json({ link: `/celebrity/${payment.celebrity.slug}/fan/${card.fanNumber}`, alreadyPaid: true });
    }
  }
  if (payment.status === "REFUNDED") {
    return NextResponse.json({ error: "This payment was refunded." }, { status: 400 });
  }
  if (!payment.celebrityId || !payment.celebrity) {
    return NextResponse.json({ error: "This payment is missing its community." }, { status: 400 });
  }
  if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
    return NextResponse.json({ error: "This payment has no amount to charge." }, { status: 400 });
  }

  const config = await getFlutterwaveConfig();
  if (!isFlutterwaveReady(config)) {
    return NextResponse.json({ error: "Card payments aren't enabled on this site yet. Please use Bank Transfer." }, { status: 400 });
  }

  const txRef = `CP-${payment.id}-${Date.now().toString(36)}`;
  const redirectUrl = `${appUrl()}/api/payments/flutterwave/callback`;

  const label = payment.membershipLevel?.name ?? "Fan Card";
  const init = await initializeFlutterwavePayment({
    txRef,
    amount: payment.amount,
    currency: payment.currency || "USD",
    email: payment.fan.email,
    name: payment.fan.name || undefined,
    redirectUrl,
    title: payment.description ?? `${payment.celebrity.name} — ${label}`,
  });

  if (!init.ok) {
    return NextResponse.json({ error: init.error }, { status: 502 });
  }

  // Persist the provider reference BEFORE the customer is redirected so the
  // webhook/callback (which arrive only after the customer has paid) can find it.
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "PENDING", provider: "flutterwave", gatewayRef: txRef },
  });

  return NextResponse.json({ link: init.link, txRef, provider: "flutterwave" });
}