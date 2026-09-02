/**
 * UNIVERSAL PAYMENT SYSTEM
 *
 * One payment flow for EVERYTHING sold on the platform — Fans Cards, event
 * tickets, VIP/meet & greet, all celebrities. Every purchase resolves to the
 * same two customer-facing methods:
 *
 *   1. "Bank Transfer"  — money goes to a real, admin-managed bank account.
 *      The customer is shown the correct account for the selected currency in
 *      a realistic bank-app view, submits transfer info + proof, and the
 *      purchase stays PENDING until an admin VERIFIES real receipt. Never paid
 *      on the customer's word alone.
 *
 *   2. "ATM Card"       — money moves through a real card processor. The
 *      gateway's brand is never shown to the customer. If no card processor is
 *      configured this option is honestly shown as "not connected yet" and is
 *      never faked.
 *
 * A "purchase" is a small wrapper over either a fans-card `Payment` row or a
 * `TicketOrder` row, exposing a common shape so the UI is identical everywhere.
 */

import { listActiveBankAccounts, getActiveBankAccountForCurrency, type PublicBankAccount } from "./banking";
import { getGateway } from "./gateways";

// The two customer-facing methods. The ATM gateway brand is never surfaced.
export const UNIVERSAL_METHOD_BANK = "bank-transfer";
export const UNIVERSAL_METHOD_CARD = "atm-card";

export type UniversalMethod = typeof UNIVERSAL_METHOD_BANK | typeof UNIVERSAL_METHOD_CARD;

export function isUniversalMethod(v: string | null | undefined): v is UniversalMethod {
  return v === UNIVERSAL_METHOD_BANK || v === UNIVERSAL_METHOD_CARD;
}

/**
 * A single payable thing. fan-card Payments and ticket orders both reduce to
 * this, so checkout code is write-once and shared by every purchase type.
 */
export type PurchasePlan = {
  kind: "FAN_CARD" | "TICKET";
  id: string; // Payment.id or TicketOrder.id
  ref: string; // human label (e.g. fan card description or orderRef)
  title: string;
  amountCents: number;
  currency: string;
};

/** Public presentation of a method for the checkout "choose a way to pay" UI. */
export type MethodCard = {
  method: UniversalMethod;
  name: string; // "Bank Transfer" | "ATM Card" (NEVER a gateway brand)
  icon: "bank" | "card";
  description: string;
  available: boolean;
  unavailableReason?: string;
  // Bank-transfer specifics (available when bank available):
  bankAccount?: PublicBankAccount | null;
};

export type UniversalMethods = { methods: MethodCard[]; defaultMethod: UniversalMethod | null };

/**
 * Resolve the universal payment methods for a purchase. This is the single
 * source of truth the whole checkout (cards AND tickets) renders from.
 */
export async function buildPaymentMethods(plan: PurchasePlan): Promise<UniversalMethods> {
  const currency = (plan.currency || "USD").toUpperCase();

  // --- Bank Transfer ------------------------------------------------------
  const bankAccounts = await listActiveBankAccounts();
  const bankForCurrency = await getActiveBankAccountForCurrency(currency);
  const bankUnavailable = !bankForCurrency
    ? !bankAccounts.length
      ? "Bank Transfer isn't set up yet on this site."
      : `Bank Transfer isn't available for ${currency} yet.`
    : undefined;

  // --- ATM Card -----------------------------------------------------------
  // A live card flow needs a registered processor with credentials. If not
  // connected, we show the option honestly (never a fake charge form).
  const cardGateway = getGateway(UNIVERSAL_METHOD_CARD);
  const cardConnected = Boolean(cardGateway && cardGateway.hasCredentials());
  const cardUnavailable = !cardConnected
    ? "ATM Card payments aren't enabled on this site yet."
    : undefined;

  const methods: MethodCard[] = [
    {
      method: UNIVERSAL_METHOD_BANK,
      name: "Bank Transfer",
      icon: "bank",
      description: "Pay directly into our bank account, then upload your proof. We verify each transfer before confirming.",
      available: !bankUnavailable,
      unavailableReason: bankUnavailable,
      bankAccount: bankForCurrency,
    },
    {
      method: UNIVERSAL_METHOD_CARD,
      name: "ATM Card",
      icon: "card",
      description: "Securely pay with your ATM / debit / credit card.",
      available: cardConnected,
      unavailableReason: cardUnavailable,
    },
  ];

  // Default: prefer Bank Transfer when available, else the first available.
  let defaultMethod: UniversalMethod | null = null;
  if (methods.find((m) => m.method === UNIVERSAL_METHOD_BANK && m.available)) defaultMethod = UNIVERSAL_METHOD_BANK;
  else defaultMethod = methods.find((m) => m.available)?.method ?? null;

  return { methods, defaultMethod };
}

/** True once a real card processor is configured end-to-end. */
export function isAtmCardReady(): boolean {
  const g = getGateway(UNIVERSAL_METHOD_CARD);
  return Boolean(g && g.hasCredentials());
}

export const ATM_CARD_PUBLIC_KEY_ENV = "ATM_CARD_PUBLIC_KEY";
export const ATM_CARD_SECRET_KEY_ENV = "ATM_CARD_SECRET_KEY";

/** Placement/status report for the admin ATM Card config. Never exposes values. */
export function atmCardConfigStatus(): {
  publicKey: boolean;
  secretKey: boolean;
  gatewayRegistered: boolean;
  connected: boolean;
} {
  const publicKey = Boolean(process.env[ATM_CARD_PUBLIC_KEY_ENV]);
  const secretKey = Boolean(process.env[ATM_CARD_SECRET_KEY_ENV]);
  const gatewayRegistered = Boolean(getGateway(UNIVERSAL_METHOD_CARD));
  return {
    publicKey,
    secretKey,
    gatewayRegistered,
    connected: gatewayRegistered && publicKey && secretKey,
  };
}