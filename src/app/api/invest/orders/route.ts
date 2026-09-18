import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentFanId } from "@/lib/auth";
import { createSubscription, listInvestorOrders } from "@/lib/invest/orders";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// GET /api/invest/orders — the caller’s subscription history.
export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  const orders = await listInvestorOrders(fanId);
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      amount: o.amount.toString(),
      fees: o.fees.toString(),
      currency: o.currency,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      opportunity: { slug: o.opportunity.slug, name: o.opportunity.name, status: o.opportunity.status },
    })),
  });
}

// POST /api/invest/orders — subscribe to an open opportunity (demo settlement).
export async function POST(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const slug = String(body?.opportunitySlug ?? "").trim();
  const raw = String(body?.amount ?? "").trim();
  const amount = /^\d+(\.\d{1,2})?$/.test(raw) ? new Prisma.Decimal(raw) : null;
  if (!slug) return NextResponse.json({ error: "opportunitySlug is required." }, { status: 400 });
  if (!amount) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });

  try {
    const result = await createSubscription({
      fanId,
      opportunitySlug: slug,
      amount,
      ipAddress: request.headers.get("x-forwarded-for"),
      ageYears: body?.ageYears != null ? Number(body.ageYears) : null,
    });
    return NextResponse.json({
      ok: true,
      order: { id: result.order.id, amount: result.order.amount.toFixed(2), status: result.order.status },
      txnRef: result.txn.txnRef,
    });
  } catch (err) {
    return investErrorResponse(err);
  }
}