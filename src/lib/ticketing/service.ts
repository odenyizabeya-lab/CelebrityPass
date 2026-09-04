// Ticketing service layer. Serves visitors from the DB only. Order flow is
// honest: never generates tickets/confirmations without a real payment.
import { prisma } from "@/lib/db";
import { computeEventStatus } from "@/lib/events/helpers";
import { isCommerceState, requireGateway } from "./gateways";
import { clampQuantity, newAccessToken, newOrderRef, pushStatusHistory } from "./helpers";
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

  const orderRef = newOrderRef();
  const accessToken = newAccessToken();

  const order = await prisma.ticketOrder.create({
    data: {
      orderRef,
      accessToken,
      fanId: input.fanId ?? null,
      eventId: event.id,
      customerName: input.customer.name.trim(),
      customerEmail: input.customer.email.trim().toLowerCase(),
      customerPhone: input.customer.phone?.trim() || null,
      customerCountry: input.customer.country?.trim() || null,
      subtotalCents: subtotal,
      feesCents: fees,
      totalCents: subtotal + fees,
      currency,
      status: "PENDING_PAYMENT",
      paymentStatus: "UNPAID",
      statusHistoryJson: pushStatusHistory(null, { status: "PENDING_PAYMENT", at: new Date().toISOString(), note: "Order created (awaiting payment)." }),
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
          status: "INITIATED",
          amountCents: subtotal + fees,
          currency,
          message: "Payment attempt not yet made.",
        },
      },
    },
    include: { items: true },
  });

  return { orderRef, accessToken, orderId: order.id };
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
 * Attempt to pay for an order. With no payment gateway connected it ALWAYS
 * blocks honestly — it never fakes a success. When a real gateway + an enabled
 * payment method are configured, this route calls the gateway and only then
 * marks the order CONFIRMED.
 */
export async function attemptOrderPayment(orderRef: string, token: string | null, paymentMethodId?: string | null) {
  const order = await getOrderForHolder(orderRef, token);
  if (!order) return { ok: false, status: 404, event: "ORDER_NOT_FOUND", message: "Order not found." };
  if (order.status === "CONFIRMED") return { ok: false, status: 409, event: "ALREADY_PAID", message: "This order is already paid." };
  if (order.status === "CANCELLED" || order.status === "REFUNDED") return { ok: false, status: 409, event: "ORDER_CLOSED", message: `This order is ${order.status.toLowerCase()}.` };

  const candidates = await prisma.paymentMethod.findMany({
    where: { isEnabled: true, hasCredentials: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  let method = paymentMethodId ? candidates.find((m) => m.id === paymentMethodId) : candidates[0];
  if (!method) {
    method = candidates[0] ?? null;
  }
  if (!method) {
    // No enabled, credential-ready payment method → log the attempt, stay pending.
    await prisma.ticketTransaction.create({
      data: {
        orderId: order.id,
        kind: "PAYMENT",
        status: "FAILED",
        amountCents: order.totalCents,
        currency: order.currency,
        message: "No payment method is enabled on this site yet. Complete the order at the official ticket source.",
      },
    });
    return {
      ok: false,
      status: 409,
      event: "NO_PAYMENT_METHOD",
      message: "No payment method is set up on this site yet. Your order is saved, but payment can't be taken until an authorized payment method is configured.",
    };
  }

  if (!isCommerceState(method.key)) {
    await prisma.ticketTransaction.create({
      data: {
        orderId: order.id,
        kind: "PAYMENT",
        status: "FAILED",
        amountCents: order.totalCents,
        currency: order.currency,
        provider: method.key,
        message: "This payment method is not connected to a live gateway yet.",
      },
    });
    return {
      ok: false,
      status: 409,
      event: "GATEWAY_NOT_CONNECTED",
      message: "This payment method isn't connected to a live gateway yet. Please use the official ticket source for now.",
    };
  }

  // Real gateway connected → run the charge. Only on success do we confirm.
  const gateway = requireGateway(method.key);
  await prisma.ticketOrder.update({ where: { id: order.id }, data: { paymentStatus: "PROCESSING", status: "PAYMENT_PROCESSING", paymentMethodId: method.id, statusHistoryJson: pushStatusHistory(order.statusHistoryJson, { status: "PAYMENT_PROCESSING", at: new Date().toISOString(), note: "Payment processing." }) } });
  await prisma.ticketTransaction.updateMany({ where: { orderId: order.id, kind: "PAYMENT", status: "INITIATED" }, data: { status: "PROCESSING", provider: method.key } }).catch(() => undefined);

  const result = await gateway.charge({ amountCents: order.totalCents, currency: order.currency, description: `Tickets — ${order.event.name} (${order.orderRef})` });
  if (!result.ok) {
    await prisma.ticketOrder.update({ where: { id: order.id }, data: { status: "FAILED", paymentStatus: "FAILED", statusHistoryJson: pushStatusHistory(order.statusHistoryJson, { status: "FAILED", at: new Date().toISOString(), note: result.error }) } });
    await prisma.ticketTransaction.create({ data: { orderId: order.id, kind: "PAYMENT", status: "FAILED", amountCents: order.totalCents, currency: order.currency, provider: method.key, message: result.error } });
    return { ok: false, status: 402, event: "PAYMENT_DECLINED", message: result.error };
  }

  const paidAt = new Date();
  await prisma.ticketOrder.update({
    where: { id: order.id },
    data: {
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paidAt,
      amountPaidCents: order.totalCents,
      paymentProvider: method.key,
      paymentRef: result.ref,
      deliveryMethod: "OFFICIAL_ACCOUNT",
      deliveryDetail: "Your order reference at the official ticket source will be provided in your confirmation.",
      paymentMethodId: method.id,
      statusHistoryJson: pushStatusHistory(order.statusHistoryJson, { status: "CONFIRMED", at: paidAt.toISOString(), note: `Paid (ref ${result.ref}).` }),
    },
  });
  await prisma.ticketTransaction.create({ data: { orderId: order.id, kind: "PAYMENT", status: "SUCCEEDED", amountCents: order.totalCents, currency: order.currency, provider: method.key, providerRef: result.ref, message: "Payment succeeded." } });

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
  );

  return { ok: true, event: "CONFIRMED", paidRef: result.ref, order: await getOrderForHolder(orderRef, token) };
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