import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";
import {
  alpacaConfigured,
  getAlpacaAccount,
  getAlpacaOrder,
  getAlpacaOrders,
  getAlpacaPositions,
  isPaper,
  mapAlpacaOrderStatus,
  parseFill,
  placeAlpacaMarketOrder,
} from "@/lib/invest/alpaca";

/**
 * BrokerageService — the ONLY door to order execution, holdings and brokerage
 * account data. The frontend never touches provider credentials: everything
 * goes through these server-side functions.
 *
 * Honest by construction:
 *  - With no provider configured the account stays NOT_CONNECTED and every
 *    order attempt is REJECTED with an honest reason — no fake order exists.
 *  - With Alpaca configured, orders are sent to the REAL Alpaca API (free
 *    paper trading by default). Executions, positions and transactions are
 *    created ONLY from data the provider actually reports back.
 *  - Paper-trading positions are marked isDemo=true and MUST be labeled
 *    DEMO / PAPER TRADING on every screen — no real money moves.
 */

export const BROKERAGE_NOT_CONFIGURED =
  "Brokerage connection unavailable. No purchase can be executed until an authorized brokerage partner is connected.";

export type BrokerAccountView = {
  id: string;
  provider: string;
  status: string; // NOT_CONNECTED | PENDING_LINK | CONNECTED | ERROR
  buyingPowerCents: number;
  currency: string;
  lastSyncAt: string | null;
};

export const QUANTITY_PRECISION = 1_000_000; // quantityCents scale (1 share = 1e6)

export function quantityToNumber(qtyCents: bigint | number): number {
  return Number(qtyCents) / QUANTITY_PRECISION;
}

export function numberToQuantity(qty: number): bigint {
  return BigInt(Math.round(qty * QUANTITY_PRECISION));
}

/** Is a real brokerage (Alpaca) connected for this deployment? */
export function brokerageActive(): boolean {
  return process.env.BROKERAGE_PROVIDER === "alpaca" && alpacaConfigured();
}

function accountView(row: {
  id: string;
  provider: string;
  status: string;
  buyingPowerCents: bigint;
  currency: string;
  lastSyncAt: Date | null;
}): BrokerAccountView {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    buyingPowerCents: Number(row.buyingPowerCents),
    currency: row.currency,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
  };
}

/** Retrieve or lazily create the user's brokerage account record. */
export async function getOrCreateBrokerAccount(fanId: string): Promise<BrokerAccountView> {
  const existing = await prisma.brokerageAccount.findUnique({ where: { fanId } });
  if (existing) return accountView(existing);

  const created = await prisma.brokerageAccount.create({
    data: {
      fanId,
      provider: "none",
      status: "NOT_CONNECTED",
      currency: "USD",
    },
  });
  return accountView(created);
}

export async function getBrokerAccount(fanId: string): Promise<BrokerAccountView | null> {
  const row = await prisma.brokerageAccount.findUnique({ where: { fanId } });
  return row ? accountView(row) : null;
}

/** Pull real account/cash data from the provider so buying power is never invented. */
export async function syncBrokerAccount(fanId: string): Promise<BrokerAccountView | null> {
  if (!brokerageActive()) return getBrokerAccount(fanId);

  const account = await getOrCreateBrokerAccount(fanId);
  try {
    const acct = await getAlpacaAccount();
    const buyingPowerCents = Math.max(0, Math.round((Number(acct.buying_power) || 0) * 100));
    const updated = await prisma.brokerageAccount.update({
      where: { id: account.id },
      data: {
        provider: "alpaca",
        status: acct.status === "ACTIVE" ? "CONNECTED" : "ERROR",
        buyingPowerCents: BigInt(buyingPowerCents),
        currency: acct.currency || "USD",
        lastSyncAt: new Date(),
      },
    });
    return accountView(updated);
  } catch {
    return accountView(
      await prisma.brokerageAccount.update({
        where: { id: account.id },
        data: { status: "ERROR", lastSyncAt: new Date() },
      }),
    );
  }
}

/**
 * Request an order. With a real provider the order is sent to Alpaca; rows are
 * written from the provider response only. Without a provider the order is
 * recorded as REJECTED with an honest reason — never a fake execution.
 */
export async function createMarketOrder(input: {
  fanId: string;
  symbol: string;
  side?: "BUY" | "SELL";
  orderType?: string;
  quantity: number; // fractional-share friendly
  limitPrice?: number;
}): Promise<{ ok: boolean; orderId?: string; status?: string; error?: string }> {
  const account = await getOrCreateBrokerAccount(input.fanId);
  const idempotencyKey = `ord_${randomUUID()}`;
  const isPaperTrade = isPaper();

  if (!brokerageActive()) {
    const order = await prisma.marketOrder.create({
      data: {
        accountId: account.id,
        symbol: input.symbol.toUpperCase(),
        side: input.side ?? "BUY",
        orderType: input.orderType ?? "MARKET",
        quantityCents: numberToQuantity(input.quantity),
        limitPriceCents: input.limitPrice ? Math.round(input.limitPrice * 100) : null,
        status: "REJECTED",
        idempotencyKey,
        rejectReason: BROKERAGE_NOT_CONFIGURED,
      },
    });
    await prisma.marketTransaction.create({
      data: {
        ref: `TX-${Date.now().toString(36).toUpperCase()}`,
        accountId: account.id,
        orderId: order.id,
        kind: "ORDER",
        status: "REJECTED",
        symbol: order.symbol,
        side: "DEBIT",
        amountCents: BigInt(0),
        quantityCents: order.quantityCents,
        currency: account.currency,
        postedAt: new Date(),
      },
    });
    return { ok: false, orderId: order.id, status: order.status, error: BROKERAGE_NOT_CONFIGURED };
  }

  // ── Real provider path (Alpaca) ─────────────────────────────────────────
  const submitted = await prisma.marketOrder.create({
    data: {
      accountId: account.id,
      symbol: input.symbol.toUpperCase(),
      side: input.side ?? "BUY",
      orderType: input.orderType ?? "MARKET",
      quantityCents: numberToQuantity(input.quantity),
      limitPriceCents: input.limitPrice ? Math.round(input.limitPrice * 100) : null,
      status: "SUBMITTED",
      idempotencyKey,
      submittedAt: new Date(),
    },
  });

  try {
    const alpacaOrder = await placeAlpacaMarketOrder({
      symbol: input.symbol.toUpperCase(),
      qty: input.quantity,
      side: input.side ?? "BUY",
    });

    const mappedStatus = mapAlpacaOrderStatus(alpacaOrder);
    const order = await prisma.marketOrder.update({
      where: { id: submitted.id },
      data: {
        brokerRef: alpacaOrder.id,
        brokerStatus: alpacaOrder.status,
        status: mappedStatus,
        rejectReason: mappedStatus === "REJECTED" ? "Alpaca rejected the order." : null,
        submittedAt: alpacaOrder.submitted_at ? new Date(alpacaOrder.submitted_at) : new Date(),
        filledAt: alpacaOrder.filled_at ? new Date(alpacaOrder.filled_at) : null,
      },
    });

    const fill = parseFill(alpacaOrder);
    if (fill && fill.quantity > 0) {
      await mirrorFill(order.id, account.id, {
        symbol: order.symbol,
        side: order.side === "SELL" ? "SELL" : "BUY",
        quantity: fill.quantity,
        price: fill.price,
        fees: fill.fees,
        brokerRef: alpacaOrder.id,
        executedAt: alpacaOrder.filled_at ? new Date(alpacaOrder.filled_at) : new Date(),
        isPaper: isPaperTrade,
      });
    }

    return { ok: mappedStatus === "FILLED" || mappedStatus === "SUBMITTED" || mappedStatus === "PARTIALLY_FILLED", orderId: order.id, status: order.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order submission failed.";
    const failed = await prisma.marketOrder.update({
      where: { id: submitted.id },
      data: { status: "FAILED", rejectReason: message },
    });
    await prisma.marketTransaction.create({
      data: {
        ref: `TX-${Date.now().toString(36).toUpperCase()}`,
        accountId: account.id,
        orderId: failed.id,
        kind: "ORDER",
        status: "FAILED",
        symbol: failed.symbol,
        side: "DEBIT",
        amountCents: BigInt(0),
        quantityCents: failed.quantityCents,
        currency: account.currency,
        postedAt: new Date(),
      },
    });
    return { ok: false, orderId: failed.id, status: failed.status, error: message };
  }
}

/** Persist a provider-reported execution as execution + position + transaction. */
async function mirrorFill(
  orderId: string,
  accountId: string,
  fill: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    price: number | null;
    fees: number;
    brokerRef: string;
    executedAt: Date;
    isPaper: boolean;
  },
): Promise<void> {
  const priceCents = fill.price !== null ? Math.round(fill.price * 100) : 0;
  const feeCents = Math.round(fill.fees * 100);

  // Idempotency: each provider fill must be mirrored exactly once. The unique
  // provider order id is stored as-is on the execution brokerRef; legacy rows
  // used a `-exec` / `-exec-<ts>` suffix — match both forms.
  const existingExecution = await prisma.marketExecution.findFirst({
    where: {
      orderId,
      OR: [{ brokerRef: fill.brokerRef }, { brokerRef: `${fill.brokerRef}-exec` }, { brokerRef: { startsWith: `${fill.brokerRef}-exec-` } }],
    },
  });
  if (existingExecution) return;

  await prisma.marketExecution.create({
    data: {
      orderId,
      accountId,
      symbol: fill.symbol,
      quantityCents: numberToQuantity(fill.quantity),
      priceCents: BigInt(priceCents),
      feeCents: BigInt(feeCents),
      brokerRef: fill.brokerRef,
      executedAt: fill.executedAt,
    },
  });

  const quantityCents = numberToQuantity(fill.quantity);
  const existing = await prisma.marketPosition.findUnique({
    where: { accountId_symbol: { accountId, symbol: fill.symbol } },
  });

  const currentQty = BigInt(existing?.quantityCents ?? 0);
  const delta = fill.side === "BUY" ? quantityCents : -quantityCents;
  const newQty = currentQty + delta;

  // Weighted average cost in integer cents per full share.
  let newAvgCostCents = existing ? existing.avgCostCents : BigInt(0);
  if (fill.side === "BUY" && newQty > 0 && priceCents > 0) {
    const totalValueCents =
      (currentQty * existing!.avgCostCents) / BigInt(QUANTITY_PRECISION) +
      (quantityCents * BigInt(priceCents)) / BigInt(QUANTITY_PRECISION);
    newAvgCostCents = (totalValueCents * BigInt(QUANTITY_PRECISION)) / newQty;
  }

  if (newQty <= 0) {
    if (existing) {
      await prisma.marketPosition.update({
        where: { id: existing.id },
        data: { isActive: false, quantityCents: BigInt(0), updatedAt: new Date() },
      });
    }
  } else {
    await prisma.marketPosition.upsert({
      where: { accountId_symbol: { accountId, symbol: fill.symbol } },
      update: {
        quantityCents: newQty,
        avgCostCents: newAvgCostCents,
        isActive: true,
        isDemo: fill.isPaper ? true : existing?.isDemo ?? false,
        updatedAt: new Date(),
      },
      create: {
        accountId,
        symbol: fill.symbol,
        quantityCents: newQty,
        avgCostCents: newAvgCostCents,
        isDemo: fill.isPaper,
      },
    });
  }

  await prisma.marketTransaction.create({
    data: {
      ref: `TX-${Date.now().toString(36).toUpperCase()}`,
      accountId,
      orderId,
      kind: "ORDER",
      status: "FILLED",
      symbol: fill.symbol,
      side: fill.side === "BUY" ? "DEBIT" : "CREDIT",
      amountCents: -BigInt(Math.round(priceCents * fill.quantity)),
      quantityCents,
      priceCents: BigInt(priceCents),
      feeCents: BigInt(feeCents),
      currency: "USD",
      brokerRef: fill.brokerRef,
      postedAt: new Date(),
    },
  });
}

/** Reconcile any provider-only order state into our rows (open order follow-up). */
export async function syncOrders(fanId: string): Promise<void> {
  if (!brokerageActive()) return;
  const account = await prisma.brokerageAccount.findUnique({ where: { fanId } });
  if (!account) return;

  const open = await prisma.marketOrder.findMany({
    where: { accountId: account.id, status: { in: ["SUBMITTED", "PARTIALLY_FILLED"] } },
  });
  for (const row of open) {
    if (!row.brokerRef) continue;
    try {
      const provider = await getAlpacaOrder(row.brokerRef);
      const mapped = mapAlpacaOrderStatus(provider);
      if (mapped === "FILLED" || mapped === "PARTIALLY_FILLED") {
        const fill = parseFill(provider);
        if (fill && fill.quantity > 0) {
          await mirrorFill(row.id, account.id, {
            symbol: row.symbol,
            side: row.side === "SELL" ? "SELL" : "BUY",
            quantity: fill.quantity,
            price: fill.price,
            fees: fill.fees,
            brokerRef: provider.id,
            executedAt: provider.filled_at ? new Date(provider.filled_at) : new Date(),
            isPaper: isPaper(),
          });
        }
      }
      await prisma.marketOrder.update({
        where: { id: row.id },
        data: { status: mapped, brokerStatus: provider.status, filledAt: provider.filled_at ? new Date(provider.filled_at) : null },
      });
    } catch (err) {
      // Leave as-is; the next sync retries.
      console.error("[syncOrders] failed to sync order", row.id, row.symbol, err instanceof Error ? err.message : err);
    }
  }
}

/** Real positions, reconciled from the provider. Demo rows are marked isDemo. */
export async function getPositions(fanId: string) {
  const account = await prisma.brokerageAccount.findUnique({ where: { fanId } });
  if (!account) return [];

  if (brokerageActive()) {
    try {
      const providerPositions = await getAlpacaPositions();
      const positions = await prisma.marketPosition.findMany({ where: { accountId: account.id } });
      const bySymbol = new Map(positions.map((p) => [p.symbol, p]));

      for (const pp of providerPositions) {
        const qty = Number(pp.qty);
        const avg = Number(pp.avg_entry_price);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        await prisma.marketPosition.upsert({
          where: { accountId_symbol: { accountId: account.id, symbol: pp.symbol } },
          update: {
            quantityCents: BigInt(Math.round(qty * QUANTITY_PRECISION)),
            avgCostCents: BigInt(Math.round(avg * 100)),
            isActive: true,
            isDemo: isPaper() || bySymbol.get(pp.symbol)?.isDemo === true,
            updatedAt: new Date(),
          },
          create: {
            accountId: account.id,
            symbol: pp.symbol,
            quantityCents: BigInt(Math.round(qty * QUANTITY_PRECISION)),
            avgCostCents: BigInt(Math.round(avg * 100)),
            isActive: true,
            isDemo: isPaper(),
          },
        });
      }
      return prisma.marketPosition.findMany({ where: { accountId: account.id, isActive: true }, orderBy: { symbol: "asc" } });
    } catch {
      // Provider unreachable — fall back to our last reconciled rows.
    }
  }

  return prisma.marketPosition.findMany({
    where: { accountId: account.id, isActive: true },
    orderBy: { symbol: "asc" },
  });
}

export async function getTransactions(fanId: string, limit = 50) {
  const account = await prisma.brokerageAccount.findUnique({ where: { fanId } });
  if (!account) return [];
  return prisma.marketTransaction.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getOrders(fanId: string, limit = 50) {
  const account = await prisma.brokerageAccount.findUnique({ where: { fanId } });
  if (!account) return [];
  await syncOrders(fanId);
  return prisma.marketOrder.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { executions: true },
  });
}