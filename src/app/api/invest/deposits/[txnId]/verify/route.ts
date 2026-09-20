// POST /api/invest/deposits/[txnId]/verify — server-side Flutterwave
// verification of a card deposit, triggered from the return page and the
// webhook. Re-queries Flutterwave directly (reference, amount, currency,
// status must all match) and ONLY then settles the pending ledger credit.
// Idempotent: an already-confirmed deposit is never double-credited, and a
// failed/cancelled one is never settled. No browser claim is ever trusted.
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { settleInvestCardDeposit } from "@/lib/invest/deposits";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ txnId: string }> }) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const transactionId = String(body?.transactionId ?? "").trim();
  if (!transactionId) {
    return NextResponse.json({ error: "Missing the card processor transaction id to verify." }, { status: 400 });
  }

  try {
    const { txnId } = await params;
    const result = await settleInvestCardDeposit({
      txnId,
      flutterwaveTransactionId: transactionId,
      fanId,
      ipAddress: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return investErrorResponse(err);
  }
}