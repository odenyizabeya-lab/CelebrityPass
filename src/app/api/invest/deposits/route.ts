import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentFanId } from "@/lib/auth";
import { createBankTransferDepositIntent } from "@/lib/invest/deposits";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// POST /api/invest/deposits
//   Opens a manual Bank Transfer / ATM deposit intent: a PENDING ledger
//   transaction + a unique deposit reference + the admin-managed bank account.
//   Nothing is credited until the admin verifies the receipt image.
export async function POST(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const raw = String(body?.amount ?? "").trim();
  const amount = /^\d+(\.\d{1,2})?$/.test(raw) ? new Prisma.Decimal(raw) : null;
  if (!amount) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });

  const opportunityId = body?.opportunityId ? String(body.opportunityId).trim().slice(0, 80) || null : null;

  try {
    const intent = await createBankTransferDepositIntent({
      fanId,
      amount,
      opportunityId,
      ipAddress: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({
      ok: true,
      mode: intent.mode,
      pendingTxnId: intent.pendingTxnId,
      depositRef: intent.depositRef,
      amount: intent.amount,
      currency: intent.currency,
      bankAccount: intent.bankAccount,
      opportunityId: intent.opportunityId,
      status: "PENDING_VERIFICATION",
    });
  } catch (err) {
    return investErrorResponse(err);
  }
}