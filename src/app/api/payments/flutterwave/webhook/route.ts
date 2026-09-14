// POST /api/payments/flutterwave/webhook — the V3 webhook, the ONLY path that
// settles a fan-card payment. Verification happens twice:
//   1. Signature: `flutterwave-signature` = base64(HMAC-SHA256(rawBody,
//      secretHash)), or the legacy `verif-hash` / `x-verif-hash` header with
//      the raw secret-hash value. The raw body is hashed, never the JSON.
//   2. Server-side re-check: after a `charge.completed` event we re-query
//      GET /transactions/{id}/verify and only settle when tx_ref, amount,
//      currency and status all match. Settlement is idempotent via the unique
//      gatewayRef + the PENDING-status guard in settlePayment.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/utils";
import { settlePayment } from "@/lib/payments";
import { verifyFlutterwaveWebhook, verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

const SUCCESS_EVENTS = new Set(["charge.completed", "charge.success"]);
const SUCCESS_STATUSES = new Set(["successful", "success", "successfully completed", "completed"]);
const FAILURE_STATUSES = new Set(["failed", "cancelled", "declined", "expired", "abandoned"]);

export async function POST(request: NextRequest) {
  const rawBody = await request.text().catch(() => "");
  const signature = request.headers.get("flutterwave-signature");
  const verifHash = request.headers.get("verif-hash") ?? request.headers.get("x-verif-hash");

  if (!(await verifyFlutterwaveWebhook({ rawBody, signatureHeader: signature, verifHashHeader: verifHash }))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  let body: unknown = null;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = null;
    }
  }
  // V3 webhooks put the event name in `event` (e.g. "charge.completed"); the
  // newer `type` field is also accepted.
  const event = String(((body as { event?: unknown } | null)?.event ?? (body as { type?: unknown } | null)?.type ?? "") || "");
  const data = (body as { data?: Record<string, unknown> } | null)?.data ?? {};

  const reference = typeof data?.tx_ref === "string" ? data.tx_ref : "";
  // V3 transaction ids are numeric (unlike v4's chg_ prefix).
  const transactionId = typeof data?.id === "string" || typeof data?.id === "number" ? String(data.id) : "";
  const chargeStatus = String(data?.status ?? "").toLowerCase();

  if (!reference) return NextResponse.json({ ok: true, ignored: true });

  const payment = await prisma.payment.findUnique({ where: { gatewayRef: reference } });
  if (!payment || payment.provider !== "flutterwave") return NextResponse.json({ ok: true, ignored: true });

  // Explicit failure reported by the webhook — the charge never succeeded.
  if (FAILURE_STATUSES.has(chargeStatus)) {
    if (payment.status === "PENDING") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    }
    return NextResponse.json({ ok: true, settled: false, failed: true });
  }

  // Not a success event/state yet — acknowledge and wait for the real one.
  if (payment.status !== "PENDING" || !SUCCESS_EVENTS.has(event) || !SUCCESS_STATUSES.has(chargeStatus)) {
    return NextResponse.json({ ok: true, settled: false });
  }

  // The webhook payload alone is never trusted — re-verify server-side.
  if (!transactionId) return NextResponse.json({ ok: true, settled: false });

  const verified = await verifyFlutterwaveTransaction(transactionId);
  if (!verified.ok) return NextResponse.json({ ok: true, settled: false });

  const tx = verified.tx;
  const refOk = tx.txRef === reference;
  const amountOk = Number(Number(tx.amount).toFixed(2)) === Number(Number(payment.amount).toFixed(2));
  const currencyOk = tx.currency.toUpperCase() === (payment.currency || "USD").toUpperCase();
  if (!refOk || !amountOk || !currencyOk || !SUCCESS_STATUSES.has(tx.status)) {
    return NextResponse.json({ ok: true, settled: false });
  }

  try {
    await settlePayment(payment.id, appUrl());
  } catch {
    return NextResponse.json({ ok: true, settled: false });
  }
  return NextResponse.json({ ok: true, settled: true });
}