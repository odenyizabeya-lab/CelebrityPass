import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nextTxnSeq, txnRefFromSeq } from "./refs";

/**
 * Accounting-ready ledger. Every financial movement is written as a balanced
 * set of LedgerEntry rows (double entry). Balances are NEVER stored as a single
 * mutable number — they are derived as SUM(LedgerEntry.amount) over an account.
 *
 * An entry `amount` is signed: positive = CREDIT, negative = DEBIT. A posting
 * must sum to exactly zero, otherwise it is rejected (never silently posted).
 */

export type LedgerLeg = { account: string; amount: Prisma.Decimal };

export function cashAccount(investorId: string): string {
  return `investor:${investorId}:cash`;
}

export function positionAccount(investorId: string, opportunityId: string): string {
  return `investor:${investorId}:position:${opportunityId}`;
}

/** Pure double-entry builder — rejects any posting that does not net to zero. */
export function buildBalancedEntries(legs: LedgerLeg[]): LedgerLeg[] {
  if (legs.length === 0) throw new Error("Ledger posting requires at least one entry");
  const zero = new Prisma.Decimal(0);
  const sum = legs.reduce((acc, leg) => acc.plus(leg.amount), zero);
  if (!sum.isZero()) {
    throw new Error(
      `Unbalanced ledger posting (net ${sum.toFixed(2)}): ${legs.map((l) => `${l.account}=${l.amount.toFixed(2)}`).join(", ")}`,
    );
  }
  return legs.map((leg) => ({ account: leg.account, amount: new Prisma.Decimal(leg.amount) }));
}

export type PostTransactionInput = {
  investorId: string;
  kind: "DEPOSIT" | "INVESTMENT" | "WITHDRAWAL" | "DISTRIBUTION" | "FEE" | "REFUND" | "ADJUSTMENT";
  direction: "CREDIT" | "DEBIT";
  amount: Prisma.Decimal;
  currency?: string;
  /** Balanced ledger legs. Ignored when pendingOnly is true. */
  legs: LedgerLeg[];
  source: string;
  description?: string;
  orderId?: string | null;
  positionId?: string | null;
  withdrawalId?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  gatewayEventId?: string | null;
  /** Create the transaction in PENDING (un-posted) state — nothing hits the ledger. */
  pendingOnly?: boolean;
};

async function allocateTxnRef(): Promise<string> {
  const seq = await nextTxnSeq();
  return txnRefFromSeq(seq);
}

/**
 * Write one transaction atomically with its balanced ledger entries.
 * Idempotency: a repeated providerRef / gatewayEventId never settles twice —
 * the persisted row is returned instead of a duplicate posting.
 *
 * Pass an interactive-transaction client when this must run *inside* an outer
 * transaction (row locks, cross-table atomicity), so the posting shares that
 * transaction instead of opening its own.
 */
export async function postTransaction(input: PostTransactionInput, client?: Prisma.TransactionClient) {
  if (input.amount.isNegative() || input.amount.isZero()) {
    throw new Error("Transaction amount must be positive");
  }
  const ref = await allocateTxnRef();
  const entries = input.pendingOnly ? [] : buildBalancedEntries(input.legs);

  async function run(tx: Prisma.TransactionClient) {
    if (input.gatewayEventId) {
      const existing = await tx.transaction.findUnique({ where: { gatewayEventId: input.gatewayEventId } });
      if (existing) return existing;
    }
    if (input.providerRef) {
      const existing = await tx.transaction.findUnique({ where: { providerRef: input.providerRef } });
      if (existing) return existing;
    }
    const txn = await tx.transaction.create({
      data: {
        txnRef: ref,
        investorId: input.investorId,
        kind: input.kind,
        direction: input.direction,
        amount: input.amount,
        currency: input.currency ?? "USD",
        status: input.pendingOnly ? "PENDING" : "SUCCESSFUL",
        orderId: input.orderId ?? null,
        positionId: input.positionId ?? null,
        withdrawalId: input.withdrawalId ?? null,
        provider: input.provider ?? null,
        providerRef: input.providerRef ?? null,
        gatewayEventId: input.gatewayEventId ?? null,
        source: input.source,
        description: input.description ?? null,
        postedAt: input.pendingOnly ? null : new Date(),
      },
    });
    if (input.pendingOnly) return txn;
    await tx.ledgerEntry.createMany({
      data: entries.map((e) => ({
        txnId: txn.id,
        account: e.account,
        amount: e.amount,
        currency: input.currency ?? "USD",
      })),
    });
    return txn;
  }

  // Inside an outer transaction the posting joins it (tx is already a
  // transaction client); otherwise we open our own transaction. Generous
  // timeouts: the hosted pooler can occasionally stall connector setup.
  if (client) return run(client);
  return prisma.$transaction((tx) => run(tx), { maxWait: 10000, timeout: 30000 });
}

/** True when every ledger entry added together is exactly zero (double-entry invariant). */
export async function isGlobalLedgerBalanced(): Promise<boolean> {
  const agg = await prisma.ledgerEntry.aggregate({ _sum: { amount: true } });
  return !!agg._sum.amount && agg._sum.amount.isZero();
}

/**
 * Settle a PENDING transaction once a real gateway charge is verified: mark it
 * SUCCESSFUL and write its balanced ledger entries in one atomic step. Ledger
 * entries move an account balance; they are posted only here, never by the
 * frontend. Idempotent — an already-settled transaction is left untouched and
 * a second call returns "already". Fails closed for non-pending rows.
 */
export async function settlePendingTransaction(input: {
  txnId: string;
  legs: LedgerLeg[];
  gatewayEventId?: string | null;
  providerRef?: string | null;
  description?: string | null;
}): Promise<"settled" | "already" | "not-pending" | "not-found"> {
  const entries = buildBalancedEntries(input.legs);

  async function run(tx: Prisma.TransactionClient): Promise<"settled" | "already" | "not-pending" | "not-found"> {
    const txn = await tx.transaction.findUnique({ where: { id: input.txnId } });
    if (!txn) return "not-found";
    if (txn.status === "SUCCESSFUL") return "already";
    if (txn.status !== "PENDING" && txn.status !== "INITIATED") return "not-pending";

    await tx.transaction.update({
      where: { id: txn.id },
      data: {
        status: "SUCCESSFUL",
        postedAt: new Date(),
        ...(input.gatewayEventId ? { gatewayEventId: input.gatewayEventId } : {}),
        ...(input.providerRef ? { providerRef: input.providerRef } : {}),
        ...(input.description ? { description: input.description } : {}),
      },
    });
    await tx.ledgerEntry.createMany({
      data: entries.map((e) => ({
        txnId: txn.id,
        account: e.account,
        amount: e.amount,
        currency: txn.currency ?? "USD",
      })),
    });
    return "settled";
  }

  return prisma.$transaction((tx) => run(tx), { maxWait: 10000, timeout: 30000 });
}

/** Derived cash balance for an investor (SUM over the cash ledger account). */
export async function cashBalance(investorId: string): Promise<Prisma.Decimal> {
  const agg = await prisma.ledgerEntry.aggregate({
    where: { account: cashAccount(investorId) },
    _sum: { amount: true },
  });
  const sum = agg._sum.amount ?? new Prisma.Decimal(0);
  return new Prisma.Decimal(sum.isNegative() ? 0 : sum);
}

/** Derived confirmed book value for one position (SUM over its ledger account). */
export async function positionBookValue(investorId: string, opportunityId: string): Promise<Prisma.Decimal> {
  const agg = await prisma.ledgerEntry.aggregate({
    where: { account: positionAccount(investorId, opportunityId) },
    _sum: { amount: true },
  });
  return new Prisma.Decimal(agg._sum.amount ?? 0);
}

export type InvestorBalances = {
  /** Spendable cash (never negative). */
  cash: Prisma.Decimal;
  /** Confirmed book value held in positions. */
  invested: Prisma.Decimal;
  /** cash + invested — never includes any invented mark-to-market. */
  total: Prisma.Decimal;
};

/** Full derived picture: cash + invested book value. Never fabricated. */
export async function investorBalances(investorId: string): Promise<InvestorBalances> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { account: cashAccount(investorId) },
    select: { account: true, amount: true },
  });
  let cash = new Prisma.Decimal(0);
  for (const row of rows) cash = cash.plus(row.amount);
  if (cash.isNegative()) cash = new Prisma.Decimal(0);

  const posAgg = await prisma.ledgerEntry.aggregate({
    where: { account: { startsWith: `investor:${investorId}:position:` } },
    _sum: { amount: true },
  });
  const invested = new Prisma.Decimal(posAgg._sum.amount ?? 0);

  return { cash, invested, total: cash.plus(invested) };
}