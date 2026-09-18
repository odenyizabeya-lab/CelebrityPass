import { NextResponse } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/invest/deposits/[txnId] — deposit status for the callback page's
// poller. Read-only and owner-scoped; the webhook is the only thing that
// changes the transaction's status.
export async function GET(_request: Request, { params }: { params: Promise<{ txnId: string }> }) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const { txnId } = await params;
  if (!txnId) return NextResponse.json({ error: "Missing deposit reference." }, { status: 400 });

  const txn = await prisma.transaction.findUnique({
    where: { id: txnId },
    select: {
      id: true,
      txnRef: true,
      investorId: true,
      kind: true,
      amount: true,
      currency: true,
      status: true,
      description: true,
    },
  });
  if (!txn) return NextResponse.json({ error: "Deposit not found." }, { status: 404 });

  const acct = await prisma.investorAccount.findUnique({ where: { id: txn.investorId }, select: { fanId: true } });
  if (!acct || acct.fanId !== fanId) return NextResponse.json({ error: "Deposit not found." }, { status: 404 });

  return NextResponse.json({
    deposit: {
      id: txn.id,
      txnRef: txn.txnRef,
      kind: txn.kind,
      amount: txn.amount.toString(),
      currency: txn.currency,
      status: txn.status,
    },
  });
}