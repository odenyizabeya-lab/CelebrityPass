// Ticketing domain types & constants.
//
// Every value that can be Wrongly faked is represented here as a strictly
// constrained status. A ticket/confirmation is ONLY ever produced after a real
// payment has succeeded through a real gateway.

// ===== Ticket inventory =====
export const TICKET_INVENTORY_STATUSES = ["AVAILABLE", "LIMITED", "SOLD_OUT", "NOT_YET_ON_SALE", "UNAVAILABLE"] as const;
export type TicketInventoryStatus = (typeof TICKET_INVENTORY_STATUSES)[number];

export function isTicketInventoryStatus(v: string): v is TicketInventoryStatus {
  return (TICKET_INVENTORY_STATUSES as readonly string[]).includes(v);
}

export function inventoryStatusLabel(s: string): string {
  switch (s) {
    case "AVAILABLE":
      return "Available";
    case "LIMITED":
      return "Limited availability";
    case "SOLD_OUT":
      return "Sold out";
    case "NOT_YET_ON_SALE":
      return "Not on sale yet";
    case "UNAVAILABLE":
      return "Not available";
    default:
      return s;
  }
}

// ===== Orders =====
export const ORDER_STATUSES = ["PENDING_PAYMENT", "PAYMENT_PROCESSING", "CONFIRMED", "FAILED", "CANCELLED", "REFUNDED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(v: string): v is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(v);
}

export function orderStatusLabel(s: string): string {
  switch (s) {
    case "PENDING_PAYMENT":
      return "Awaiting payment";
    case "PAYMENT_PROCESSING":
      return "Payment processing";
    case "CONFIRMED":
      return "Confirmed";
    case "FAILED":
      return "Payment failed";
    case "CANCELLED":
      return "Cancelled";
    case "REFUNDED":
      return "Refunded";
    default:
      return s;
  }
}

// ===== Payment state =====
export const PAYMENT_STATUSES = ["UNPAID", "PROCESSING", "PAID", "FAILED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isPaymentStatus(v: string): v is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(v);
}

export function paymentStatusLabel(s: string): string {
  switch (s) {
    case "UNPAID":
      return "Unpaid";
    case "PROCESSING":
      return "Processing";
    case "PAID":
      return "Paid";
    case "FAILED":
      return "Failed";
    case "REFUNDED":
      return "Refunded";
    default:
      return s;
  }
}

// ===== Transactions =====
export const TRANSACTION_KINDS = ["PAYMENT", "REFUND"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const TRANSACTION_STATUSES = ["INITIATED", "PROCESSING", "SUCCEEDED", "FAILED"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export function isTransactionStatus(v: string): v is TransactionStatus {
  return (TRANSACTION_STATUSES as readonly string[]).includes(v);
}

// ===== Delivery =====
export const DELIVERY_METHODS = ["DIGITAL", "MOBILE", "DOWNLOAD", "OFFICIAL_ACCOUNT"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export function deliveryMethodLabel(s: string | null | undefined): string {
  switch (s) {
    case "DIGITAL":
      return "Digital ticket";
    case "MOBILE":
      return "Mobile ticket";
    case "DOWNLOAD":
      return "Downloadable ticket";
    case "OFFICIAL_ACCOUNT":
      return "Delivered to your account at the official ticket source";
    default:
      return "Not specified";
  }
}

// ===== Payment methods =====
export const PAYMENT_METHOD_KINDS = ["CARD", "BANK_TRANSFER", "WALLET"] as const;
export type PaymentMethodKind = (typeof PAYMENT_METHOD_KINDS)[number];

export function isPaymentMethodKind(v: string): v is PaymentMethodKind {
  return (PAYMENT_METHOD_KINDS as readonly string[]).includes(v);
}

export function paymentMethodKindLabel(s: string): string {
  switch (s) {
    case "CARD":
      return "Card";
    case "BANK_TRANSFER":
      return "Bank transfer";
    case "WALLET":
      return "Digital wallet";
    default:
      return s;
  }
}

// Max tickets per order per ticket type (safety cap; availability may be lower).
export const MAX_TICKETS_PER_ORDER = 8;

/** Interval (minutes) used only to display an estimated "next sync" time. */
export const SYNC_INTERVAL_MINUTES = (() => {
  const v = Number(process.env.TICKET_SYNC_INTERVAL_MINUTES);
  return Number.isFinite(v) && v > 0 ? v : 60;
})();