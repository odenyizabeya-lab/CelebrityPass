// /api/payments/[id]/flutterwave
//
// GET  — client-safe setup for the fan-card ATM Card checkout: the fan profile
//        (name/email/phone) for display + the payment link (tx_ref) and the
//        page the fan returns to after paying. NO secrets are returned here.
//
// POST — create the Flutterwave V3 hosted checkout (Standard flow) for this
//        payment: POST /v3/payments with the fan's details from their account,
//        get back the hosted link, and redirect the fan there. Flutterwave
//        collects the card details on their own payment page — card data NEVER
//        reaches this server.
//
// Settlement is done solely by the webhook route after a server-side
// GET /transactions/{id}/verify re-check.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { appUrl } from "@/lib/utils";
import {
  createFlutterwaveHostedCheckout,
  getFlutterwaveConfig,
  isFlutterwaveReady,
} from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET — checkout setup (no secrets, no card data)
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in to complete your purchase" }, { status: 401 });

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      celebrity: { select: { slug: true, name: true } },
      membershipLevel: { select: { name: true } },
    },
  });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (payment.fanId !== fanId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payment.status === "PAID") return NextResponse.json({ error: "Already paid" }, { status: 409 });

  const config = await getFlutterwaveConfig();
  if (!isFlutterwaveReady(config)) {
    return NextResponse.json({ error: "Card payments aren't enabled on this site yet. Please use Bank Transfer." }, { status: 400 });
  }

  const fan = await prisma.fan.findUnique({ where: { id: fanId }, select: { name: true, email: true, phone: true } });
  if (!fan) return NextResponse.json({ error: "Your account could not be found." }, { status: 401 });

  const txRef = `CP-${payment.id}`;
  const redirectUrl = `${appUrl()}/api/payments/flutterwave/callback?ref=${encodeURIComponent(payment.id)}`;

  return NextResponse.json({
    ok: true,
    txRef,
    redirectUrl,
    customer: {
      name: fan?.name ?? "",
      email: fan?.email ?? "",
      phone: fan?.phone ?? "",
    },
    amount: payment.amount,
    currency: payment.currency || "USD",
    title: payment.description ?? payment.membershipLevel?.name ?? "Fan Card",
  });
}

// ---------------------------------------------------------------------------
// POST — create the V3 hosted checkout and return the payment link
// ---------------------------------------------------------------------------

export async function POST(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in to complete your purchase" }, { status: 401 });

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
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
      return NextResponse.json({ ok: true, alreadyPaid: true, redirectUrl: `/celebrity/${payment.celebrity.slug}/fan/${card.fanNumber}` });
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

  const fan = await prisma.fan.findUnique({ where: { id: fanId }, select: { name: true, email: true, phone: true } });
  if (!fan) return NextResponse.json({ error: "Your account could not be found." }, { status: 401 });

  // V3 `tx_ref` must be unique per transaction and stable across retries so the
  // webhook can always find this payment and retries never create a duplicate.
  const txRef = `CP-${payment.id}`;
  const redirectUrl = `${appUrl()}/api/payments/flutterwave/callback?ref=${encodeURIComponent(payment.id)}`;

  const result = await createFlutterwaveHostedCheckout({
    txRef,
    amount: payment.amount,
    currency: payment.currency || "USD",
    redirectUrl,
    customer: {
      name: fan.name || "Fan",
      email: fan.email || "",
      ...((fan.phone ?? "").trim() ? { phonenumber: fan.phone!.trim() } : {}),
    },
    title: payment.description ?? payment.membershipLevel?.name ?? "Fan Card",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Persist the provider reference BEFORE the fan is redirected so the webhook
  // can always find this payment.
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "PENDING", provider: "flutterwave", gatewayRef: txRef },
  });

  return NextResponse.json({
    ok: true,
    link: result.link,
    txRef,
    status: result.status,
  });
}