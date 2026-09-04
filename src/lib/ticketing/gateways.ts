// Payment gateway registry for ticket orders.
//
// When a real gateway is registered AND its credentials are present, the
// checkout flow can charge cards. Until then the order stays "awaiting
// payment" and NEVER fakes a confirmation.
export type ChargeInput = {
  amountCents: number;
  currency: string;
  description: string;
};

export type ChargeResult = { ok: true; ref: string } | { ok: false; error: string };

export interface PaymentGateway {
  readonly key: string;
  readonly label: string;
  /** Environment variable names that must hold this gateway's credentials. */
  readonly credentialEnvKeys: string[];
  hasCredentials(): boolean;
  charge(input: ChargeInput): Promise<ChargeResult>;
}

// ---------------------------------------------------------------------------
// Stripe gateway — real card charges via the Stripe REST API.
// Requires STRIPE_SECRET_KEY in the environment.
// ---------------------------------------------------------------------------
const stripeGateway: PaymentGateway = {
  key: "atm-card",
  label: "Stripe (Card)",
  credentialEnvKeys: ["STRIPE_SECRET_KEY"],
  hasCredentials() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  },
  async charge(input: ChargeInput) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return { ok: false, error: "Stripe is not configured on this site." };
    }

    const params = new URLSearchParams();
    params.append("amount", String(input.amountCents));
    params.append("currency", input.currency.toLowerCase());
    params.append("description", input.description);

    // For tokenized payments (from Stripe.js Elements or similar), the client
    // sends a `source` or `payment_method` token. When using the universal
    // atm-card route, the provider field carries the token reference.
    // Stripe charges can also be created server-side with a source if needed.
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

// Register all real gateways here as they are authorized/configured:
export const gateways: PaymentGateway[] = [stripeGateway];

export function getGateway(key: string | null | undefined): PaymentGateway | undefined {
  return gateways.find((g) => g.key === key);
}

export function requireGateway(key: string): PaymentGateway {
  const gateway = getGateway(key);
  if (!gateway) throw new Error(`Gateway "${key}" is not connected.`);
  return gateway;
}

/** True when a real, credential-ready gateway is registered for this method key. */
export function isCommerceState(methodKey: string | null | undefined): boolean {
  const gateway = getGateway(methodKey);
  return Boolean(gateway && gateway.hasCredentials());
}
