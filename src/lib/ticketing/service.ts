// Ticketing service layer. Serves visitors from the DB only. Order flow is
// honest: never generates tickets/confirmations without a real payment.
import { prisma } from "@/lib/db";
import { computeEventStatus } from "@/lib/events/helpers";
import { clampQuantity, newAccessToken, newOrderRef, newTicketCode, pushStatusHistory } from "./helpers";
import { MAX_TICKETS_PER_ORDER } from "./types";
import type { PrismaClient } from "@prisma/client";

// ============================== INVENTORY ==============================

export type TicketOptionPublic = {
  inventoryId: string;
  name: string;
  category: string | null;
  priceCents: number;
  feesCents: number;
  currency: string;
  quantityAvailable: number | null;
  quantityTotal: number | null;
  status: string;
  url: string | null;
  sellable: boolean;
  sourceName: string | null;
  sourceUrl: string | null;
};

export async function getEventTicketView(eventId: string) {
  const event = await prisma.celebrityEvent.findUnique({
    where: { eventId },
    include: { celebrity: { select: { slug: true, name: true, accentColor: true } } },
  });
  if (!event) return null;

  const eventStatus = computeEventStatus({
    statusOverride: event.statusOverride,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
  });
  const buyable = eventStatus === "UPCOMING";

  const rows = await prisma.ticketInventory.findMany({
    where: { eventId: event.id, displayAuthorized: true },
    include: { source: { select: { name: true, baseUrl: true } } },
    orderBy: [{ priceCents: "asc" }, { name: "asc" }],
  });

  const tickets: TicketOptionPublic[] = rows.map((r) => ({
    inventoryId: r.id,
    name: r.name,
    category: r.category,
    priceCents: r.priceCents,
    feesCents: r.feesCents,
    currency: r.currency || "USD",
    quantityAvailable: r.quantityAvailable,
    quantityTotal: r.quantityTotal,
    status: r.status,
    url: r.url,
    sellable:
      buyable &&
      (r.status === "AVAILABLE" || r.status === "LIMITED") &&
      (r.quantityAvailable == null || r.quantityAvailable > 0),
    sourceName: r.source?.name ?? null,
    sourceUrl: r.source?.baseUrl ?? null,
  }));

  const synced = rows.map((r) => r.lastSyncedAt).filter((d): d is Date => !!d).map((d) => d.getTime()).sort((a, b) => b - a)[0] ?? null;

  return { event, eventStatus, buyable, tickets, hasInventory: rows.length > 0, ticketLastSyncedAt: synced ? new Date(synced) : null };
}

export async function hasAvailableTickets(celebrityId: string): Promise<Set<string>> {
  const rows = await prisma.ticketInventory.findMany({
    where: {
      displayAuthorized: true,
      status: { in: ["AVAILABLE", "LIMITED"] },
      OR: [{ quantityAvailable: null }, { quantityAvailable: { gt: 0 } }],
      event: { celebrityId, status: "UPCOMING", statusOverride: null },
    },
    select: { event: { select: { eventId: true } } },
    take: 500,
  });
  return new Set(rows.map((r) => r.event.eventId));
}

// ============================== ORDERS ==============================

type CustomerInfo = { name: string; email: string; phone?: string | null; country?: string | null };

export async function createTicketOrder(input: {
  eventId: string;
  items: { inventoryId: string; quantity: number }[];
  customer: CustomerInfo;
  fanId?: string | null;
}) {
  const event = await prisma.celebrityEvent.findUnique({ where: { eventId: input.eventId } });
  if (!event) throw new Error("Event not found");

  const eventStatus = computeEventStatus({
    statusOverride: event.statusOverride,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
  });
  if (eventStatus !== "UPCOMING") throw new Error("Tickets are not available for this event right now.");

  if (!input.items.length) throw new Error("Select at least one ticket.");
  if (!input.customer.name?.trim() || !input.customer.email?.trim()) throw new Error("Name and email are required.");

  const ids = input.items.map((i) => i.inventoryId);
  const invRows = await prisma.ticketInventory.findMany({
    where: { id: { in: ids }, eventId: event.id, displayAuthorized: true },
  });
  if (invRows.length !== ids.length) throw new Error("One or more ticket types are no longer available.");

  // Validate each requested line against the last-synced availability.
  const lines: {
    inventoryId: string;
    ticketName: string;
    category: string | null;
    quantity: number;
    unitPriceCents: number;
    feesEachCents: number;
    currency: string;
  }[] = [];
  let currency = "USD";
  for (const req of input.items) {
    const inv = invRows.find((i) => i.id === req.inventoryId);
    if (!inv) throw new Error("Ticket type not found.");
    if (inv.status !== "AVAILABLE" && inv.status !== "LIMITED") throw new Error(`"${inv.name}" is not available.`);
    const qty = clampQuantity(req.quantity, inv.quantityAvailable, MAX_TICKETS_PER_ORDER);
    if (inv.quantityAvailable != null && qty > inv.quantityAvailable) {
      throw new Error(`Only ${inv.quantityAvailable} ticket(s) left for "${inv.name}".`);
    }
    if (currency && inv.currency && inv.currency !== currency) throw new Error("Order currency mismatch.");
    currency = inv.currency || "USD";
    lines.push({
      inventoryId: inv.id,
      ticketName: inv.name,
      category: inv.category,
      quantity: qty,
      unitPriceCents: inv.priceCents,
      feesEachCents: inv.feesCents,
      currency: inv.currency || "USD",
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const fees = lines.reduce((sum, l) => sum + l.feesEachCents * l.quantity, 0);
  const totalCents = subtotal + fees;
  const isFree = totalCents === 0;

  const orderRef = newOrderRef();
  const accessToken = newAccessToken();
  const ticketCode = isFree ? newTicketCode() : null;

  const order = await prisma.ticketOrder.create({
    data: {
      orderRef,
      accessToken,
      ticketCode,
      fanId: input.fanId ?? null,
      eventId: event.id,
      customerName: input.customer.name.trim(),
      customerEmail: input.customer.email.trim().toLowerCase(),
      customerPhone: input.customer.phone?.trim() || null,
      customerCountry: input.customer.country?.trim() || null,
      subtotalCents: subtotal,
      feesCents: fees,
      totalCents,
      currency,
      status: isFree ? "CONFIRMED" : "PENDING_PAYMENT",
      paymentStatus: isFree ? "PAID" : "UNPAID",
      paidAt: isFree ? new Date() : null,
      amountPaidCents: isFree ? 0 : null,
      deliveryMethod: isFree ? "DIGITAL" : null,
      deliveryDetail: isFree ? "Free registration — show your QR ticket at the door." : null,
      statusHistoryJson: pushStatusHistory(null, {
        status: isFree ? "CONFIRMED" : "PENDING_PAYMENT",
        at: new Date().toISOString(),
        note: isFree ? "Free registration confirmed instantly." : "Order created (awaiting payment).",
      }),
      items: {
        create: lines.map((l) => ({
          inventoryId: l.inventoryId,
          eventId: event.id,
          ticketName: l.ticketName,
          category: l.category,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          feesEachCents: l.feesEachCents,
          subtotalCents: l.unitPriceCents * l.quantity,
          currency: l.currency,
        })),
      },
      transactions: {
        create: {
          kind: "PAYMENT",
          status: isFree ? "SUCCEEDED" : "INITIATED",
          amountCents: totalCents,
          currency,
          message: isFree ? "Free registration — no payment required." : "Payment attempt not yet made.",
        },
      },
    },
    include: { items: true },
  });

  // For free orders: create EventRegistration record and update event count
  if (isFree && ticketCode) {
    const qrData = JSON.stringify({ ticketCode, eventId: event.eventId, orderRef });
    await prisma.eventRegistration.create({
      data: {
        eventId: event.id,
        orderId: order.id,
        name: input.customer.name.trim(),
        email: input.customer.email.trim().toLowerCase(),
        phone: input.customer.phone?.trim() || null,
        country: input.customer.country?.trim() || null,
        ticketCode,
        ticketQrData: qrData,
      },
    });
    await prisma.celebrityEvent.update({
      where: { id: event.id },
      data: { registrationCount: { increment: 1 } },
    });

    // Fire confirmation email (non-blocking).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    import("../emails").then(({ notifyOrderConfirmed }) =>
      notifyOrderConfirmed({
        to: input.customer.email.trim().toLowerCase(),
        customerName: input.customer.name.trim(),
        orderRef: order.orderRef,
        eventName: event.name,
        totalCents: 0,
        currency,
        items: lines.map((l) => ({ ticketName: l.ticketName, quantity: l.quantity, subtotalCents: 0 })),
        orderUrl: `${appUrl}/order/${order.orderRef}?t=${accessToken}`,
      }),
    );
  }

  return { orderRef, accessToken, orderId: order.id, ticketCode };
}

export function orderPublicView(order: {
  id: string;
  orderRef: string;
  status: string;
  paymentStatus: string;
  currency: string;
  totalCents: number;
  subtotalCents: number;
  feesCents: number;
  items: { ticketName: string; category: string | null; quantity: number; unitPriceCents: number; subtotalCents: number; currency: string }[];
  event: { eventId: string; name: string; celebrity: { slug: string; name: string } };
  paymentMethod?: { name: string } | null;
}) {
  return {
    orderRef: order.orderRef,
    status: order.status,
    paymentStatus: order.paymentStatus,
    currency: order.currency,
    totalCents: order.totalCents,
    subtotalCents: order.subtotalCents,
    feesCents: order.feesCents,
    items: order.items,
    event: {
      eventId: order.event.eventId,
      name: order.event.name,
      celebritySlug: order.event.celebrity.slug,
      celebrityName: order.event.celebrity.name,
    },
    paymentMethod: order.paymentMethod?.name ?? null,
  };
}

/** Full order view — only when the caller proves ownership via the access token. */
export async function getOrderForHolder(orderRef: string, token: string | null) {
  if (!token) return null;
  const order = await prisma.ticketOrder.findUnique({
    where: { orderRef },
    include: {
      items: true,
      transactions: { orderBy: { createdAt: "asc" } },
      event: { select: { eventId: true, name: true, startAt: true, timezone: true, venue: true, city: true, celebrity: { select: { slug: true, name: true } } } },
      paymentMethod: { select: { name: true } },
    },
  });
  if (!order || order.accessToken !== token) return null;
  return order;
}

export async function cancelOrderForHolder(orderRef: string, token: string | null) {
  if (!token) return { ok: false, status: 403, message: "Not authorized to manage this order." };
  const order = await prisma.ticketOrder.findUnique({ where: { orderRef } });
  if (!order) return { ok: false, status: 404, message: "Order not found." };
  if (order.accessToken !== token) return { ok: false, status: 403, message: "Not authorized to manage this order." };
  if (order.status === "CONFIRMED") return { ok: false, status: 409, message: "This order is already confirmed — contact support for changes." };
  if (order.status === "REFUNDED" || order.status === "CANCELLED") return { ok: false, status: 409, message: "This order is already closed." };
  await prisma.ticketOrder.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      statusHistoryJson: pushStatusHistory(order.statusHistoryJson, { status: "CANCELLED", at: new Date().toISOString(), note: "Cancelled by the customer." }),
    },
  });
  await prisma.ticketTransaction.updateMany({
    where: { orderId: order.id, kind: "PAYMENT", status: "INITIATED" },
    data: { status: "FAILED", message: "Order cancelled before payment." },
  }).catch(() => undefined);
  return { ok: true, message: "Order cancelled." };
}

/**
 * Mark a ticket order CONFIRMED after its Flutterwave payment is verified
 * server-side (webhook). Lookup is by the stable `paymentRef` (the tx_ref we
 * saved when the hosted checkout was created). Idempotent: an already
 * confirmed order returns true without touching anything.
 */
export async function settleTicketOrderByPaymentRef(txRef: string): Promise<{ ok: boolean; refunded?: boolean }> {
  const order = await prisma.ticketOrder.findFirst({
    where: { paymentRef: txRef },
    include: { event: { select: { name: true } }, items: true },
  });
  if (!order) return { ok: false };
  if (order.status === "CONFIRMED") return { ok: true };
  if (order.status === "CANCELLED" || order.status === "REFUNDED") return { ok: false, refunded: true };

  const paidAt = new Date();
  await prisma.ticketOrder.update({
    where: { id: order.id },
    data: {
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paidAt,
      amountPaidCents: order.totalCents,
      paymentProvider: "flutterwave",
      paymentRef: txRef,
      deliveryMethod: "OFFICIAL_ACCOUNT",
      deliveryDetail: "Your official ticket source reference is being prepared.",
      paymentMethodId: null,
      statusHistoryJson: pushStatusHistory(order.statusHistoryJson, { status: "CONFIRMED", at: paidAt.toISOString(), note: `Paid via ATM Card (ref ${txRef}).` }),
    },
  });
  await prisma.ticketTransaction
    .create({
      data: { orderId: order.id, kind: "PAYMENT", status: "SUCCEEDED", amountCents: order.totalCents, currency: order.currency, provider: "flutterwave", providerRef: txRef, message: "ATM Card payment succeeded." },
    })
    .catch(() => undefined);

  // Fire confirmation email (non-blocking).
  import("../emails").then(({ notifyOrderConfirmed }) =>
    notifyOrderConfirmed({
      to: order.customerEmail,
      customerName: order.customerName,
      orderRef: order.orderRef,
      eventName: order.event.name,
      totalCents: order.totalCents,
      currency: order.currency,
      items: order.items.map((i) => ({ ticketName: i.ticketName, quantity: i.quantity, subtotalCents: i.unitPriceCents * i.quantity })),
      orderUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/order/${order.orderRef}?t=${order.accessToken}`,
    }),
  ).catch(() => undefined);

  return { ok: true };
}

// ============================== ADMIN ==============================

export async function listAdminInventory(filters: { search?: string | null; status?: string | null; celebrityId?: string | null }) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.celebrityId) where.event = { celebrityId: filters.celebrityId };
  const rows = await prisma.ticketInventory.findMany({
    where,
    include: { event: { include: { celebrity: { select: { name: true } } } }, source: { select: { name: true } } },
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
  });
  const q = filters.search?.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) => [r.name, r.category, r.event.name, r.event.celebrity.name, r.source?.name].filter(Boolean).some((f) => String(f).toLowerCase().includes(q)))
    : rows;
  return visible;
}

export async function listAdminOrders(filters: { status?: string | null; search?: string | null }) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  const rows = await prisma.ticketOrder.findMany({
    where,
    include: {
      event: { select: { name: true, celebrity: { select: { name: true } } } },
      items: true,
      paymentMethod: { select: { name: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });
  const q = filters.search?.trim().toLowerCase();
  const visible = q
    ? rows.filter((o) =>
        [o.orderRef, o.customerEmail, o.customerName, o.event.name, o.event.celebrity.name]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q)),
      )
    : rows;
  return visible;
}

export async function getAdminOrder(id: string) {
  return prisma.ticketOrder.findUnique({
    where: { id },
    include: {
      items: true,
      transactions: { orderBy: { createdAt: "asc" } },
      event: { include: { celebrity: { select: { name: true, slug: true } } } },
      paymentMethod: true,
    },
  });
}

/** Log a refund REQUEST. The refund is only recorded after real money moves. */
export async function requestRefund(orderId: string, note: string) {
  const order = await prisma.ticketOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, message: "Order not found." };
  if (order.paymentStatus !== "PAID") return { ok: false, message: "Only paid orders can be refunded." };
  await prisma.ticketOrder.update({
    where: { id: orderId },
    data: { notes: [order.notes, `Refund requested: ${note || "via ticket source backoffice"}`].filter(Boolean).join("\n") },
  });
  await prisma.ticketTransaction.create({
    data: {
      orderId,
      kind: "REFUND",
      status: "INITIATED",
      amountCents: order.amountPaidCents ?? order.totalCents,
      currency: order.currency,
      message: `Refund requested but not yet processed: ${note || "no gateway connected"}`,
    },
  });
  return { ok: true, message: "Refund request logged. It is processed when money actually moves." };
}

/** Record a refund that has REALLY been processed (external reference required). */
export async function recordRefund(orderId: string, reference: string, note?: string) {
  const order = await prisma.ticketOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, message: "Order not found." };
  if (order.paymentStatus !== "PAID" && order.status !== "CONFIRMED") return { ok: false, message: "Only paid orders can be recorded as refunded." };
  const ref = reference.trim();
  if (!ref) return { ok: false, message: "A real refund reference from the ticket source is required." };
  await prisma.ticketOrder.update({
    where: { id: orderId },
    data: {
      status: "REFUNDED",
      paymentStatus: "REFUNDED",
      notes: [order.notes, note && `Refund note: ${note}`].filter(Boolean).join("\n").slice(0, 2000),
      statusHistoryJson: pushStatusHistory(order.statusHistoryJson, { status: "REFUNDED", at: new Date().toISOString(), note: `Refund recorded (ref ${ref}).` }),
    },
  });
  await prisma.ticketTransaction.create({
    data: { orderId, kind: "REFUND", status: "SUCCEEDED", amountCents: order.amountPaidCents ?? order.totalCents, currency: order.currency, providerRef: ref, message: note ?? "Refund processed at the ticket source." },
  });
  await prisma.bankTransferProof.updateMany({
    where: { ticketOrderId: orderId, status: "APPROVED" },
    data: { status: "REFUNDED", adminNote: "Refunded after admin processed the refund." },
  }).catch(() => undefined);
  return { ok: true, message: "Refund recorded." };
}

export async function getTicketStats() {
  const [byStatus, revenue, inventoryCount, paymentMethods, recentOrders] = await Promise.all([
    prisma.ticketOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.ticketOrder.aggregate({ where: { status: "CONFIRMED", paymentStatus: "PAID" }, _sum: { totalCents: true } }),
    prisma.ticketInventory.count(),
    prisma.paymentMethod.findMany({ select: { id: true, name: true, isEnabled: true, hasCredentials: true, hasSettlementAccount: true } }),
    prisma.ticketOrder.findMany({ include: { event: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return { byStatus, revenueCents: revenue._sum.totalCents ?? 0, inventoryCount, paymentMethods, recentOrders };
}

export async function listSettlementRecords(paymentMethodId?: string) {
  return prisma.settlementRecord.findMany({
    where: paymentMethodId ? { paymentMethodId } : {},
    include: { paymentMethod: { select: { name: true, key: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function addSettlementRecord(input: {
  paymentMethodId: string;
  amountCents: number;
  currency?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  reference?: string | null;
  note?: string | null;
}) {
  const method = await prisma.paymentMethod.findUnique({ where: { id: input.paymentMethodId } });
  if (!method) throw new Error("Payment method not found.");
  return prisma.settlementRecord.create({
    data: {
      paymentMethodId: input.paymentMethodId,
      amountCents: Math.round(input.amountCents),
      currency: input.currency || method.currency || "USD",
      periodStart: input.periodStart ? new Date(input.periodStart) : null,
      periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
      reference: input.reference || null,
      note: input.note || null,
    },
  });
}

export type { PrismaClient };