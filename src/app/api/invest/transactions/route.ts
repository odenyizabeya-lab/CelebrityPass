import { NextResponse } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { listInvestorTransactions } from "@/lib/invest/orders";

export const dynamic = "force-dynamic";

// GET /api/invest/transactions — the caller’s ledger-backed transaction history.
export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  const txns = await listInvestorTransactions(fanId);
  return NextResponse.json({
    transactions: txns.map((t) => ({
      txnRef: t.txnRef,
      kind: t.kind,
      direction: t.direction,
      amount: t.amount.toString(),
      currency: t.currency,
      status: t.status,
      source: t.source,
      description: t.description,
      postedAt: t.postedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}