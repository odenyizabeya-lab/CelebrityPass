/**
 * Payment helpers.
 *
 * ALL card payments — fan cards AND event tickets — go through Flutterwave V3
 * (hosted checkout; see `./payments/flutterwave.ts`). Bank Transfer is the
 * other method. There is no direct card-charging provider any more: card data
 * is collected only on Flutterwave's own page, never on this server.
 */
import { appUrl, cardUrlFor } from "./utils";

/** Currency formatting shared by the whole app, e.g. USD -> "$49.99". */
export function formatMoney(amount: number | null | undefined, currency = "USD"): string {
  // Defensive: a non-finite or missing amount formats as $0.00, never "NaN".
  const safeAmount = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toFixed(2)}`;
  }
}

/**
 * Complete a PENDING payment: mark it PAID and issue the fan's card.
 * Safe to call again — already-settled payments simply return their card.
 */
export async function settlePayment(paymentId: string, origin?: string | null) {
  const { prisma } = await import("./db");
  const { issueFanCard } = await import("./cards");

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { celebrity: { select: { slug: true, name: true } }, membershipLevel: { select: { id: true } } },
  });
  if (!payment) throw new Error("Payment not found");

  // Already settled → return the existing card.
  if (payment.cardId) {
    const card = await prisma.fanCard.findUnique({
      where: { id: payment.cardId },
      include: { celebrity: true, fan: true, membershipLevel: true },
    });
    return card;
  }
  if (!payment.celebrityId) throw new Error("Payment is missing a community");

  const card = await issueFanCard({
    fanId: payment.fanId,
    celebrityId: payment.celebrityId,
    membershipLevelId: payment.membershipLevelId,
    origin,
  });

  // Durable payment-confirmation email. This is the ONLY spot that settles a
  // fan-card payment, and payment.gatewayRef + cardId guard run twice at the
  // database level — even a doubled webhook/call can never send it twice.
  prisma.fanCard
    .findUnique({
      where: { id: card.id },
      include: { celebrity: true, fan: true, membershipLevel: true },
    })
    .then(async (final) => {
      if (!final) return;
      const { sendPaymentReceipt } = await import("./emails/senders");
      await sendPaymentReceipt({
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          gatewayRef: payment.gatewayRef,
          paidAt: new Date(),
        },
        fan: { id: final.fan.id, name: final.fan.name, email: final.fan.email },
        celebrityName: final.celebrity.name,
        level: final.membershipLevel?.name ?? "Fan Card",
        cardNumber: final.fanNumber,
        cardUrl: `${origin ?? appUrl()}${final.cardUrl ?? cardUrlFor(final.celebrity.slug, final.fanNumber)}`,
      });
    })
    .catch((err) => console.error("[email] Payment receipt send failed:", err));

  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidAt: new Date(), cardId: card.id },
  }).then(async () =>
    prisma.fanCard.findUnique({
      where: { id: card.id },
      include: { celebrity: true, fan: true, membershipLevel: true },
    }),
  );
}