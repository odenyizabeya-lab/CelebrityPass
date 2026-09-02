// Payment gateway registry.
//
// No gateway is connected yet by design. Real implementations (Stripe, PayPal,
// bank-transfer, or a ticket provider's own payment flow) are registered here
// LATER, and only then does the checkout actually move money. Until then the
// order flow stays "awaiting payment" and NEVER fakes a confirmation.
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

// Register real gateways here as they are authorized/configured:
export const gateways: PaymentGateway[] = [];

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