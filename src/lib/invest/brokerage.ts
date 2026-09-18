import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";

/**
 * BrokerageService — the ONLY door to order execution, holdings and brokerage
 * account data. The frontend never touches provider credentials: everything
 * goes through these server-side functions.
 *
 * Honest by construction:
 *  - With no provider configured (BROKERAGE_PROVIDER unset) the account stays
 *    NOT_CONNECTED and every order attempt is REJECTED with
 *    "Brokerage connection unavailable". No fake order is ever recorded.
 *  - Nothing is ever called a "position" unless a FILLED execution from the
 *    actual provider created it.
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

const PROVIDER_ACTIVE = process.env.BROKERAGE_PROVIDER && process.env.BROKERAGE_PROVIDER !== "none";

/**
 * Request an order. Returns { ok, order?, error? }.
 * NEVER fabricates an execution: without a connected provider the order is
 * recorded as REJECTED with an honest reason and no position is created.
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

  const order = await prisma.marketOrder.create({
    data: {
      accountId: account.id,
      symbol: input.symbol.toUpperCase(),
      side: input.side ?? "BUY",
      orderType: input.orderType ?? "MARKET",
      quantityCents: numberToQuantity(input.quantity),
      limitPriceCents: input.limitPrice ? Math.round(input.limitPrice * 100) : null,
      status: PROVIDER_ACTIVE ? "SUBMITTED" : "REJECTED",
      idempotencyKey,
      rejectReason: PROVIDER_ACTIVE ? null : BROKERAGE_NOT_CONFIGURED,
      ...(PROVIDER_ACTIVE ? { submittedAt: new Date() } : {}),
    },
  });

  if (!PROVIDER_ACTIVE) {
    // Honor rejections to the admin/market order list even without a provider.
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

  return { ok: true, orderId: order.id, status: order.status };
}

export async function getPositions(fanId: string) {
  const account = await prisma.brokerageAccount.findUnique({ where: { fanId } });
  if (!account) return [];
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
  return prisma.marketOrder.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { executions: true },
  });
}