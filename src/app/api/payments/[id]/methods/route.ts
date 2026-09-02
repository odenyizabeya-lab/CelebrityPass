import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { buildPaymentMethods } from "@/lib/ticketing/universal";

export const dynamic = "force-dynamic";

// GET /api/payments/[id]/methods — universal payment methods for a fan-card payment.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (payment.fanId !== fanId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = {
    kind: "FAN_CARD" as const,
    id: payment.id,
    ref: payment.description ?? "Fan Card",
    title: payment.description ?? "Fan Card",
    amountCents: Math.round(payment.amount * 100),
    currency: payment.currency || "USD",
  };
  const { methods, defaultMethod } = await buildPaymentMethods(plan);
  return NextResponse.json({ methods, defaultMethod });
}