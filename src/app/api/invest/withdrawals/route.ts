import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { requestWithdrawal } from "@/lib/invest/withdrawals";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// GET /api/invest/withdrawals — the caller’s withdrawal requests.
export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  const account = await prisma.investorAccount.findUnique({ where: { fanId } });
  if (!account) return NextResponse.json({ withdrawals: [] });
  const rows = await prisma.withdrawal.findMany({
    where: { investorId: account.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    withdrawals: rows.map((w) => ({
      id: w.id,
      ref: w.ref,
      amount: w.amount.toString(),
      status: w.status,
      createdAt: w.createdAt.toISOString(),
      approvedAt: w.approvedAt?.toISOString() ?? null,
    })),
  });
}

// POST /api/invest/withdrawals — request a cash withdrawal (review required).
export async function POST(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  try {
    const wd = await requestWithdrawal({
      fanId,
      amountValue: body?.amount,
      destinationLabel: body?.destinationLabel ? String(body.destinationLabel) : null,
      ipAddress: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({ ok: true, withdrawal: { id: wd.id, ref: wd.ref, amount: wd.amount.toFixed(2), status: wd.status } }, { status: 201 });
  } catch (err) {
    return investErrorResponse(err);
  }
}