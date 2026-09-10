// GET /api/payments/flutterwave/callback — Flutterwave redirects the customer
// here after payment. We verify the transaction server-side (reference, amount,
// currency, status) BEFORE settling — a card is only ever issued after an
// actual, matching, successful charge. Then we redirect to the fan's card page.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/utils";
import { settlePayment } from "@/lib/payments";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

const ABANDONED_STATUSES = new Set(["cancelled", "declined", "failed", "expired"]);
const SUCCESS_STATUSES = new Set(["successful", "success", "completed"]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const txRef = (searchParams.get("tx_ref") || searchParams.get("trxref") || "").trim();
  if (!txRef) return NextResponse.redirect(`${appUrl()}`);

  const payment = await prisma.payment.findUnique({
    where: { gatewayRef: txRef },
    include: { celebrity: { select: { slug: true } } },
  });
  if (!payment || payment.provider !== "flutterwave" || !payment.celebrityId) {
    return NextResponse.redirect(`${appUrl()}`);
  }

  const checkout = (extra: string) => NextResponse.redirect(`${appUrl()}/checkout/${payment.id}${extra}`);

  // Flutterwave reports a user cancelling via ?status=...
  const statusParam = (searchParams.get("status") ?? "").toLowerCase();
  if (ABANDONED_STATUSES.has(statusParam)) {
    return checkout(`?status=${statusParam}`);
  }
  if (payment.status === "PAID" && payment.cardId) {
    const card = await prisma.fanCard.findUnique({ where: { id: payment.cardId } });
    if (card && payment.celebrity) {
      return NextResponse.redirect(`${appUrl()}/celebrity/${payment.celebrity.slug}/fan/${card.fanNumber}`);
    }
  }
  if (payment.status !== "PENDING") {
    return checkout(`?status=${payment.status.toLowerCase()}`);
  }

  // Always verify server-side — never trust the redirect query alone.
  const verified = await verifyFlutterwaveTransaction(txRef);
  if (!verified.ok) return checkout("?status=error");

  const tx = verified.transaction;
  const amountOk = Number(Number(tx.amount).toFixed(2)) === Number(Number(payment.amount).toFixed(2));
  const currencyOk = tx.currency.toUpperCase() === (payment.currency || "USD").toUpperCase();

  if (!SUCCESS_STATUSES.has(tx.status)) {
    if (ABANDONED_STATUSES.has(tx.status)) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    }
    return checkout(`?status=${tx.status || "error"}`);
  }
  if (!amountOk || !currencyOk) {
    // A charge settled with the wrong amount/currency must never issue a card.
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return checkout("?status=mismatch");
  }

  const origin = request.headers.get("origin") ?? appUrl();
  let card = null;
  try {
    card = await settlePayment(payment.id, origin);
  } catch {
    card = null;
  }
  if (!card || !card.celebrity?.slug) return checkout("?status=error");

  return NextResponse.redirect(`${appUrl()}/celebrity/${card.celebrity.slug}/fan/${card.fanNumber}`);
}