// POST /api/payments/[id]/flutterwave/authorize
//
// Continue a pending Flutterwave V4 charge by submitting the authorization the
// charge asked for (AVS billing address, encrypted PIN, or OTP). The payload is
// exactly the `next_action` step the fan is on:
//
//   { chargeId, authorization: { type: "avs", avs: { address: {...} } } }
//   { chargeId, authorization: { type: "pin", pin: { nonce, encrypted_pin } } }
//   { chargeId, authorization: { type: "otp", otp: { code } } }
//
// Returns the updated chargeId + next step (the same shape as the initial POST),
// so the same client state machine can keep driving redirects / PIN → OTP → 3DS.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import {
  authorizeFlutterwaveCharge,
  type FwAuthorizePayload,
} from "@/lib/payments/flutterwave";
import { countryToAlpha2 } from "@/lib/payments/flutterwave-countries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in to complete your purchase" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const chargeId = typeof body?.chargeId === "string" && body.chargeId ? String(body.chargeId) : "";
  let authorization = body?.authorization as FwAuthorizePayload | undefined;

  if (!chargeId) return NextResponse.json({ error: "Missing charge reference." }, { status: 400 });
  if (!authorization || typeof authorization.type !== "string") {
    return NextResponse.json({ error: "Missing authorization data." }, { status: 400 });
  }

  if (authorization.type === "avs") {
    const address = authorization.avs?.address;
    if (
      !address ||
      !["country", "city", "line1", "postal_code", "state"].every(
        (k) => typeof (address as Record<string, unknown>)[k] === "string" && ((address as Record<string, unknown>)[k] as string).trim(),
      )
    ) {
      return NextResponse.json({ error: "Billing address is required." }, { status: 400 });
    }
    // AVS addresses also require ISO2 — normalize before forwarding.
    const countryCode = countryToAlpha2(address.country);
    if (!countryCode) return NextResponse.json({ error: "Billing address needs a valid country." }, { status: 400 });
    authorization = {
      type: "avs",
      avs: {
        address: {
          country: countryCode,
          city: address.city,
          line1: address.line1,
          postal_code: address.postal_code,
          state: address.state,
          ...(address.line2?.trim() ? { line2: address.line2 } : {}),
        },
      },
    } as FwAuthorizePayload;
  }
  if (authorization.type === "pin" && (typeof authorization.pin?.nonce !== "string" || authorization.pin.nonce.length !== 12 || !authorization.pin.encrypted_pin)) {
    return NextResponse.json({ error: "Invalid PIN data." }, { status: 400 });
  }
  if (authorization.type === "otp" && !/^\d{4,8}$/.test(String(authorization.otp?.code ?? ""))) {
    return NextResponse.json({ error: "Invalid OTP." }, { status: 400 });
  }

  // The fan must own a PENDING flutterwave payment whose gatewayRef maps to this charge.
  const payment = await prisma.payment.findFirst({
    where: { id, fanId, provider: "flutterwave", status: "PENDING", gatewayRef: { not: null } },
  });
  if (!payment) return NextResponse.json({ error: "No pending card payment to authorize." }, { status: 404 });

  const result = await authorizeFlutterwaveCharge(chargeId, authorization);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, chargeId: result.chargeId, status: result.status, nextAction: result.nextAction });
}