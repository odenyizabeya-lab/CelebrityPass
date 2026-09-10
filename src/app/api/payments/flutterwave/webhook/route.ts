// POST /api/payments/flutterwave/webhook — Flutterwave webhook (backup of the
// callback). The `x-verif-hash` header must match the configured webhook secret.
// Settlement is idempotent: a payment is only settled once per its gatewayRef,
// and only after a server-side verification of amount/currency/status.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/utils";
import { settlePayment } from "@/lib/payments";
import { verifyFlutterwaveWebhook, verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

const SUCCESS_EVENTS = new Set(["charge.completed", "charge.success"]);
const SUCCESS_STATUSES = new Set(["successful", "success", "completed"]);

export async function POST(request: NextRequest) {
  const hash = request.headers.get("x-verif-hash");
  if (!(await verifyFlutterwaveWebhook(hash))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const event = String(body?.event ?? "");
  const data = body?.data ?? {};
  const txRef = typeof data?.tx_ref === "string" ? data.tx_ref : "";
  if (!txRef) return NextResponse.json({ ok: true, ignored: true });

  const payment = await prisma.payment.findUnique({ where: { gatewayRef: txRef } });
  if (!payment || payment.status !== "PENDING") return NextResponse.json({ ok: true, ignored: true });

  const chargeStatus = String(data?.status ?? "").toLowerCase();
  if (!SUCCESS_EVENTS.has(event) || !SUCCESS_STATUSES.has(chargeStatus)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Double-check server-side before settling — the payload alone is not enough.
  const verified = await verifyFlutterwaveTransaction(txRef);
  if (!verified.ok) return NextResponse.json({ ok: true, settled: false });

  const tx = verified.transaction;
  const amountOk = Number(Number(tx.amount).toFixed(2)) === Number(Number(payment.amount).toFixed(2));
  const currencyOk = tx.currency.toUpperCase() === (payment.currency || "USD").toUpperCase();
  if (!SUCCESS_STATUSES.has(tx.status) || !amountOk || !currencyOk) {
    return NextResponse.json({ ok: true, settled: false });
  }

  try {
    await settlePayment(payment.id, appUrl());
  } catch {
    return NextResponse.json({ ok: true, settled: false });
  }
  return NextResponse.json({ ok: true, settled: true });
}