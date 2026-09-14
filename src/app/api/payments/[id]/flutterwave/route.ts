// /api/payments/[id]/flutterwave
//
// GET  — client-facing setup for the fan-card ATM Card checkout:
//        the browser-side AES-GCM encryption key (safe to expose: it only lets
//        the caller encrypt card fields) + the fan's name/email/phone/country
//        so the billing-address form can be prefilled. The charge is NEVER
//        created here; that happens on POST (or continueCardAuthorization).
//
// POST — create the Flutterwave V4 charge for this payment using a card already
//        encrypted in the browser (POST /customers → /payment-methods → /charges).
//        Returns the chargeId + the next_action step the fan must complete
//        (redirect_url / requires_pin / requires_otp / requires_additional_fields).
//
// The fan's card data NEVER hits this server: only AES-256-GCM ciphertexts and
// a one-off nonce arrive here. Settlement is done solely by the webhook route
// after a server-side GET /charges/{id} re-check.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { appUrl } from "@/lib/utils";
import {
  createFlutterwaveCardCharge,
  getFlutterwaveConfig,
  isFlutterwaveReady,
  type FwEncryptedCard,
  type FwCustomerAddress,
} from "@/lib/payments/flutterwave";
import { countryToAlpha2, ISO_COUNTRY_CODES } from "@/lib/payments/flutterwave-countries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type FanLike = {
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dialCode(country: string | null | undefined): string {
  // Best-effort dial codes for billing-address AVS/customer creation. Only used
  // as a fallback so fan cards still work for fans without a phone on file.
  switch ((country || "").toUpperCase()) {
    case "US":
    case "CA":
      return "1";
    case "NG":
      return "234";
    case "GH":
      return "233";
    case "KE":
      return "254";
    case "ZA":
      return "27";
    case "GB":
      return "44";
    case "AU":
      return "61";
    default:
      return "1";
  }
}

function buildCustomerPayload(fan: FanLike, billingAddress: FwCustomerAddress) {
  const fullName = (fan.name || "").trim();
  const spaceIdx = fullName.indexOf(" ");
  const firstName = spaceIdx > 0 ? fullName.slice(0, spaceIdx) : fullName || "Fan";
  const lastName = spaceIdx > 0 ? fullName.slice(spaceIdx + 1) : "Fan";

  // V4 wants a 7-10 digit *national* number plus a separate country code.
  // Stored fan numbers may be E.164-ish ("+234 801 234 5678"), so strip any
  // leading country code and keep only the national part once it's valid.
  const countryCode = dialCode(fan.country || billingAddress.country);
  const allDigits = (fan.phone || "").replace(/\D/g, "").slice(0, 15);
  let national = "";
  if (allDigits.length >= 7) {
    let local = allDigits;
    if (local.startsWith("00")) local = local.slice(2);
    if (local.length > 10) {
      if (countryCode && local.startsWith(countryCode)) local = local.slice(countryCode.length);
      else if (countryCode === "1" && local.startsWith("1")) local = local.slice(1);
      else local = local.slice(local.length - 10); // last-resort: take the trailing national digits
    }
    local = local.slice(0, 10);
    if (local.length >= 7) national = local;
  }

  return {
    email: (fan.email || "").toLowerCase(),
    firstName,
    lastName,
    ...(national ? { phone: { countryCode, number: national } } : {}),
  };
}

// ---------------------------------------------------------------------------
// GET — checkout setup for the fan-card card form
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
  if (!isFlutterwaveReady(config) || !config.encryptionKey) {
    return NextResponse.json({ error: "Card payments aren't enabled on this site yet. Please use Bank Transfer." }, { status: 400 });
  }

  const fan = await prisma.fan.findUnique({ where: { id: fanId }, select: { name: true, email: true, phone: true, country: true } });
  if (!fan) return NextResponse.json({ error: "Your account could not be found." }, { status: 401 });

  const txRef = `CP-${payment.id}`;
  const redirectUrl = `${appUrl()}/api/payments/flutterwave/callback?ref=${encodeURIComponent(payment.id)}`;

  return NextResponse.json({
    ok: true,
    encryptionKey: config.encryptionKey, // AES-GCM key — safe for the browser to encrypt card fields
    txRef,
    redirectUrl,
    customer: {
      name: fan?.name ?? "",
      email: fan?.email ?? "",
      phone: fan?.phone ?? "",
      country: countryToAlpha2(fan?.country), // the form's Country select stores ISO2
    },
    amount: payment.amount,
    currency: payment.currency || "USD",
    title: payment.description ?? payment.membershipLevel?.name ?? "Fan Card",
  });
}

// ---------------------------------------------------------------------------
// POST — create the V4 charge from a browser-encrypted card
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in to complete your purchase" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const encryptedCard = body?.encryptedCard as FwEncryptedCard | undefined;
  const billingAddress = body?.billingAddress as FwCustomerAddress | undefined;

  if (!encryptedCard || typeof encryptedCard.nonce !== "string" || encryptedCard.nonce.length !== 12) {
    return NextResponse.json({ error: "Invalid encrypted card data." }, { status: 400 });
  }
  if (
    !billingAddress ||
    !["country", "city", "line1", "postal_code", "state"].every((k) => typeof (billingAddress as Record<string, unknown>)[k] === "string" && ((billingAddress as Record<string, unknown>)[k] as string).trim())
  ) {
    return NextResponse.json({ error: "Billing address is required." }, { status: 400 });
  }
  // The V4 API only accepts ISO2 country codes for addresses. Normalize the
  // fan's input ("United States", "usa", "US"…) to the code before anything is sent.
  const countryCode = countryToAlpha2(billingAddress.country);
  if (!countryCode || !(countryCode in Object.fromEntries(Object.values(ISO_COUNTRY_CODES).map((c) => [c, 1])))) {
    return NextResponse.json({ error: "Billing address needs a valid country." }, { status: 400 });
  }
  const normalizedAddress: FwCustomerAddress = {
    country: countryCode,
    city: billingAddress.city,
    line1: billingAddress.line1,
    postal_code: billingAddress.postal_code,
    state: billingAddress.state,
    ...(billingAddress.line2?.trim() ? { line2: billingAddress.line2 } : {}),
  };

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
  if (!isFlutterwaveReady(config) || !config.encryptionKey) {
    return NextResponse.json({ error: "Card payments aren't enabled on this site yet. Please use Bank Transfer." }, { status: 400 });
  }

  const fan = await prisma.fan.findUnique({ where: { id: fanId }, select: { name: true, email: true, phone: true, country: true } });
  if (!fan) return NextResponse.json({ error: "Your account could not be found." }, { status: 401 });

  // V4 `reference` must match ^[a-zA-Z0-9\-]+$ and be ≤42 chars, and it must be
  // stable across retries so the webhook can always find this payment.
  const txRef = `CP-${payment.id}`;
  const redirectUrl = `${appUrl()}/api/payments/flutterwave/callback?ref=${encodeURIComponent(payment.id)}`;

  const result = await createFlutterwaveCardCharge({
    txRef,
    amount: payment.amount,
    currency: payment.currency || "USD",
    redirectUrl,
    customer: buildCustomerPayload(fan, normalizedAddress),
    address: normalizedAddress,
    encryptedCard,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Persist the provider reference BEFORE the customer completes authorization
  // so the webhook can always find this payment. A failed charge never marks this.
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "PENDING", provider: "flutterwave", gatewayRef: txRef },
  });

  return NextResponse.json({
    ok: true,
    chargeId: result.chargeId,
    txRef,
    status: result.status,
    nextAction: result.nextAction,
  });
}