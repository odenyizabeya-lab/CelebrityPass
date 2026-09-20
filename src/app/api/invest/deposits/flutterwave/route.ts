// POST /api/invest/deposits/flutterwave — create a REAL Flutterwave hosted
// checkout for a card ("ATM Card") deposit. Opens the PENDING ledger intent
// server-side (nothing credits) and returns the official secure checkout link.
// The deposit is only confirmed later by server-side verification of the
// charge — never on the browser's word. Secret keys stay in the backend.
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentFanId } from "@/lib/auth";
import { createInvestCardCheckout } from "@/lib/invest/deposits";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const raw = String(body?.amount ?? "").trim();
  const amount = /^\d+(\.\d{1,2})?$/.test(raw) ? new Prisma.Decimal(raw) : null;
  if (!amount) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });

  const opportunityId = body?.opportunityId ? String(body.opportunityId).trim().slice(0, 80) || null : null;

  try {
    const result = await createInvestCardCheckout({
      fanId,
      amount,
      opportunityId,
      ipAddress: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(result);
  } catch (err) {
    return investErrorResponse(err);
  }
}