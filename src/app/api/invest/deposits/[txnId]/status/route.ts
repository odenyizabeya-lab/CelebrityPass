// GET /api/invest/deposits/[txnId]/status — read-only deposit status, owned by
// the signed-in investor. Used by the Flutterwave return page while it waits
// for the webhook to settle the charge. Never settles anything.
import { NextResponse } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ txnId: string }> }) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  try {
    const { txnId } = await params;
    const txn = await prisma.transaction.findUnique({
      where: { id: txnId },
      include: { investor: { select: { fanId: true } } },
    });
    if (!txn || txn.kind !== "DEPOSIT" || txn.investor.fanId !== fanId) {
      return investmentStatusResponse(null);
    }

    return investmentStatusResponse({
      id: txn.id,
      status: txn.status,
      amount: txn.amount.toFixed(2),
      currency: txn.currency || "USD",
      depositRef: txn.providerRef,
      provider: txn.provider,
    });
  } catch (err) {
    return investErrorResponse(err);
  }
}

function investmentStatusResponse(deposit: {
  id: string;
  status: string;
  amount: string;
  currency: string;
  depositRef: string | null;
  provider: string | null;
} | null) {
  return NextResponse.json({ ok: true, deposit });
}