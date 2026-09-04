/**
 * Payment gateway layer.
 *
 * All money movement flows through a PaymentProvider. Set PAYMENT_PROVIDER in
 * `.env` to "mock" (dev-only) or "stripe" (production). When "stripe" is set,
 * STRIPE_SECRET_KEY must also be present.
 */

export type CardDetails = {
  name: string;
  number: string;
  expiry: string; // MM/YY
  cvc: string;
};

export type ChargeInput = {
  amount: number;
  currency: string;
  description: string;
  card: CardDetails;
};

export type ChargeResult = { ok: true; ref: string } | { ok: false; error: string };

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  charge(input: ChargeInput): Promise<ChargeResult>;
}

/** Currency formatting shared by the whole app, e.g. USD -> "$49.99". */
export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Luhn checksum — a quick sanity check before sending card data anywhere. */
export function luhnCheck(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Validate basic card fields. Returns an error message or null when valid. */
export function validateCardDetails(card: CardDetails): string | null {
  const number = (card.number ?? "").replace(/\s+/g, "");
  if (number.length < 13 || number.length > 19 || !/^\d+$/.test(number)) {
    return "Enter a valid card number.";
  }
  if (!luhnCheck(number)) {
    return "This card number looks invalid.";
  }
  const m = (card.expiry ?? "").trim().match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) return "Enter expiry as MM/YY.";
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return "Enter a valid expiry month.";
  const now = new Date();
  const exp = new Date(year, month, 1); // first day after the expiry month
  if (exp <= now) return "This card has expired.";
  if (!/^\d{3,4}$/.test(card.cvc ?? "")) return "Enter a valid security code.";
  if (!(card.name ?? "").trim()) return "Enter the cardholder name.";
  return null;
}

/** Simulated gateway — authorizes instantly, declines test cards ending 0002. */
const mockProvider: PaymentProvider = {
  id: "mock",
  label: "Mock Payment Gateway",
  async charge(input: ChargeInput) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const { card } = input;
    const number = (card.number ?? "").replace(/\s+/g, "");
    if (number.endsWith("0002")) {
      return { ok: false, error: "Your bank declined this transaction. Try another card." };
    }
    const ref = `mock_ch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return { ok: true, ref };
  },
};

/**
 * Real Stripe payment provider. Uses the Stripe REST API directly (no SDK
 * dependency). Requires STRIPE_SECRET_KEY in the environment.
 */
const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Stripe",
  async charge(input: ChargeInput) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return { ok: false, error: "Stripe is not configured on this site." };
    }

    const [expMonth, expYear] = input.card.expiry.split("/").map((s) => s.trim());
    const amountInCents = Math.round(input.amount * 100);

    const params = new URLSearchParams();
    params.append("amount", String(amountInCents));
    params.append("currency", input.currency.toLowerCase());
    params.append("description", input.description);
    params.append("source[number]", input.card.number.replace(/\s+/g, ""));
    params.append("source[exp_month]", expMonth);
    params.append("source[exp_year]", `20${expYear}`);
    params.append("source[cvc]", input.card.cvc);
    params.append("source[name]", input.card.name);
    params.append("capture", "true");

    const res = await fetch("https://api.stripe.com/v1/charges", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg =
        data?.error?.message ??
        (res.status === 402
          ? "Your bank declined this transaction."
          : "Payment processing failed. Please try again.");
      return { ok: false, error: msg };
    }

    return { ok: true, ref: data.id };
  },
};

/**
 * Return the configured payment provider. Swap implementations here or via
 * the PAYMENT_PROVIDER env var without touching the rest of the app.
 *
 * Fail-closed: only the explicitly-configured provider is used. An unknown
 * provider name throws instead of silently falling back to the mock, so a
 * production misconfiguration can never result in free (unsettled) cards.
 */
export function getPaymentProvider(): PaymentProvider {
  const id = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  if (id === "mock") return mockProvider;
  if (id === "stripe") return stripeProvider;
  throw new Error(`Payment provider "${id}" is not configured.`);
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