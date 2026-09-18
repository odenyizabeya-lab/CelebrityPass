import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentFanId } from "@/lib/auth";
import { createDemoDeposit } from "@/lib/invest/orders";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// POST /api/invest/deposits — DEMO/TEST deposit into the demo cash wallet.
export async function POST(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const raw = String(body?.amount ?? "").trim();
  const amount = /^\d+(\.\d{1,2})?$/.test(raw) ? new Prisma.Decimal(raw) : null;
  if (!amount) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });

  const clientRef = String(body?.clientRef ?? "default").trim().slice(0, 60) || "default";

  try {
    const txn = await createDemoDeposit({
      fanId,
      amount,
      clientRef,
      ipAddress: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({
      ok: true,
      txnRef: txn.txnRef,
      amount: txn.amount.toFixed(2),
      status: txn.status,
    });
  } catch (err) {
    return investErrorResponse(err);
  }
}