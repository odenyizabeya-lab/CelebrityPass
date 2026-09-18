import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { postTransaction, cashAccount, positionAccount, buildBalancedEntries } from "./ledger";
import { getOrCreateInvestorAccount } from "./account";
import { getOpportunityBySlug, validateOppAmount, isAcceptingFunds, checkEligibility, requiredDisclosures, parseDisclosures, type OpportunityView } from "./opportunities";
import { validateInvestAmount, isDemoMode, formatMoney } from "./mode";
import { auditLog, notifyInvestor } from "./audit";

/**
 * DEMO-provider settlement. In live mode these flows would be driven by a real
 * gateway webhook; here a backend-owned simulated provider event moves each
 * item through INITIATED → SUCCESSFUL with balanced ledger rows. The frontend
 * can never set a successful state — every success originates server-side.
 */

export class InvestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Demo deposit: credits cash only through the ledger, idempotent per clientRef. */
export async function createDemoDeposit(input: {
  fanId: string;
  amount: Prisma.Decimal;
  clientRef: string;
  ipAddress?: string | null;
}) {
  const error = validateInvestAmount(input.amount);
  if (error) throw new InvestError("AMOUNT_INVALID", error);

  const account = await getOrCreateInvestorAccount(input.fanId, input.ipAddress);
  const eventId = `demo-deposit:${account.fanId}:${input.clientRef}`;

  const txn = await postTransaction({
    investorId: account.id,
    kind: "DEPOSIT",
    direction: "CREDIT",
    amount: input.amount,
    legs: buildBalancedEntries([
      { account: cashAccount(account.id), amount: input.amount },
      { account: "platform:liability", amount: input.amount.negated() },
    ]),
    source: "demo-provider",
    gatewayEventId: eventId,
    providerRef: `demo:${eventId}`,
    provider: "demo",
    description: `Demo deposit ${formatMoney(input.amount)}`,
  });

  await auditLog({
    actorType: "investor",
    actorId: input.fanId,
    action: "PAYMENT_CONFIRMED",
    entityType: "Transaction",
    entityId: txn.id,
    details: { kind: "DEPOSIT", amount: input.amount.toFixed(2), source: "demo-provider" },
    ipAddress: input.ipAddress,
  }).catch(() => {});
  const demo = await isDemoMode();
  await notifyInvestor({
    investorId: account.id,
    type: demo ? "PAYMENT_CONFIRMED" : "PAYMENT_PENDING",
    title: demo ? "Demo deposit confirmed" : "Deposit is being verified",
    body: `${formatMoney(input.amount)} was added to your demo cash balance.`,
  }).catch(() => {});

  return txn;
}

function feeFor(opp: OpportunityView, amount: Prisma.Decimal): Prisma.Decimal {
  let rate = new Prisma.Decimal(0);
  try {
    const parsed = opp.feesJson ? (JSON.parse(opp.feesJson) as { subscriptionRate?: string | number }) : null;
    rate = new Prisma.Decimal(parsed?.subscriptionRate ?? 0);
  } catch {
    rate = new Prisma.Decimal(0);
  }
  if (rate.isNegative() || rate.isZero()) return new Prisma.Decimal(0);
  return amount.times(rate).dividedBy(100).toDecimalPlaces(2);
}

/**
 * Create a subscription. Serialized per investor (row lock) so two concurrent
 * subscriptions can never overdraw cash. Everything is validated server-side:
 * amount range, eligibility, disclosures, cash sufficiency.
 */
export async function createSubscription(input: {
  fanId: string;
  opportunitySlug: string;
  amount: Prisma.Decimal;
  ipAddress?: string | null;
  ageYears?: number | null;
}) {
  const amountError = validateInvestAmount(input.amount);
  if (amountError) throw new InvestError("AMOUNT_INVALID", amountError);

  const account = await getOrCreateInvestorAccount(input.fanId, input.ipAddress);
  const opp = await getOpportunityBySlug(input.opportunitySlug);
  if (!opp) throw new InvestError("NOT_FOUND", "Investment opportunity not found.");
  if (!isAcceptingFunds(opp)) throw new InvestError("NOT_OPEN", "This investment is not currently open to new subscriptions.");
  const oppError = validateOppAmount(opp, input.amount);
  if (oppError) throw new InvestError("AMOUNT_INVALID", oppError);

  const eligError = await checkEligibility({
    opp,
    investor: { country: account.country, kycStatus: account.kycStatus },
    ageYears: input.ageYears,
  });
  if (eligError) throw new InvestError("NOT_ELIGIBLE", eligError);

  const required = requiredDisclosures(opp);
  if (required.length > 0) {
    const accepted = await prisma.disclosureAcceptance.findMany({
      where: { investorId: account.id, opportunityId: opp.id },
      select: { documentKey: true, documentVersion: true },
    });
    const keys = new Set(required.map((d) => `${d.key}:${d.version}`));
    for (const a of accepted) keys.delete(`${a.documentKey}:${a.documentVersion}`);
    if (keys.size > 0) {
      throw new InvestError("DISCLOSURES_REQUIRED", "You must review and accept the required disclosures before investing.");
    }
  }

  const fee = feeFor(opp, input.amount);
  const total = input.amount.plus(fee);
  const checks = { amount: input.amount.toFixed(2), fee: fee.toFixed(2), total: total.toFixed(2), at: new Date().toISOString() };

  // One retry loop: the only recoverable failure is a txnRef collision.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Serialize subscriptions per investor (row lock).
          await tx.$executeRaw`SELECT id FROM "InvestorAccount" WHERE id = ${account.id} FOR UPDATE`;

          const cashRows = await tx.ledgerEntry.aggregate({
            where: { account: cashAccount(account.id) },
            _sum: { amount: true },
          });
          const cash = new Prisma.Decimal(cashRows._sum.amount ?? 0);
          if (cash.lessThan(total)) {
            throw new InvestError("INSUFFICIENT_FUNDS", `Insufficient funds (need ${formatMoney(total)}; available ${formatMoney(cash.isNegative() ? 0 : cash)}). Add funds first.`);
          }

          const order = await tx.investmentOrder.create({
            data: {
              investorId: account.id,
              opportunityId: opp.id,
              amount: input.amount,
              fees: fee,
              status: "INITIATED",
              eligibilityChecksJson: JSON.stringify(checks),
              provider: "demo",
            },
          });

          const gatewayEventId = `demo-order-settle:${order.id}`;
          const position = await tx.investmentPosition.create({
            data: {
              investorId: account.id,
              opportunityId: opp.id,
              amount: input.amount,
              currency: opp.currency,
              status: "ACTIVE",
            },
          });

          const txn = await postTransaction(
            {
              investorId: account.id,
              kind: "INVESTMENT",
              direction: "DEBIT",
              amount: input.amount,
              legs: buildBalancedEntries([
                { account: cashAccount(account.id), amount: total.negated() },
                { account: positionAccount(account.id, opp.id), amount: input.amount },
                { account: "platform:fees", amount: fee },
              ]),
              source: "demo-provider",
              gatewayEventId,
              providerRef: `demo:${gatewayEventId}`,
              provider: "demo",
              orderId: order.id,
              positionId: position.id,
              description: `Investment in ${opp.name} (${formatMoney(input.amount)})`,
            },
            tx,
          );

          await tx.investmentOrder.update({
            where: { id: order.id },
            data: { status: "SUCCESSFUL" },
          });
          order.status = "SUCCESSFUL";

          await tx.complianceAlert.create({
            data: {
              investorId: account.id,
              level: input.amount.gte(10_000) ? "MEDIUM" : "LOW",
              ruleKey: "SUSPICIOUS_AMOUNT",
              message: input.amount.gte(10_000) ? "Large subscription for manual wallet review." : "Subscription recorded for monitoring.",
            },
          });

          await tx.investNotification.create({
            data: {
              investorId: account.id,
              type: "INVESTMENT_CONFIRMED",
              title: "Investment confirmed",
              body: `Your ${formatMoney(input.amount)} subscription to ${opp.name} is confirmed and recorded in your demo portfolio.`,
            },
          });

          return { order, position, txn };
        },
        { maxWait: 10000, timeout: 30000 },
      );
    } catch (err) {
      if ((err as { code?: string }).code === "P2002" && attempt < 2) continue;
      throw err;
    }
  }
  throw new InvestError("INTERNAL", "Could not record the subscription. Please try again.");
}

export async function acknowledgedDisclosures(fanId: string, opportunitySlug: string) {
  const account = await getOrCreateInvestorAccount(fanId);
  const opp = await getOpportunityBySlug(opportunitySlug);
  if (!opp) return { opportunity: null as null, required: [] as string[], accepted: [] as string[] };
  const required = parseDisclosures(opp.disclosuresJson);
  const rows = await prisma.disclosureAcceptance.findMany({
    where: { investorId: account.id, opportunityId: opp.id },
    select: { documentKey: true, documentVersion: true, documentTitle: true, acceptedAt: true },
  });
  return {
    opportunity: opp,
    required,
    accepted: rows,
  };
}

export async function acceptDisclosure(input: {
  fanId: string;
  opportunityId: string;
  documentKey: string;
  documentVersion: string;
  documentTitle?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const account = await getOrCreateInvestorAccount(input.fanId, input.ipAddress);
  await prisma.disclosureAcceptance
    .create({
      data: {
        investorId: account.id,
        opportunityId: input.opportunityId,
        documentKey: input.documentKey,
        documentVersion: input.documentVersion,
        documentTitle: input.documentTitle ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
    .catch((err) => {
      if ((err as { code?: string }).code !== "P2002") throw err; // already accepted = fine
    });
  await auditLog({
    actorType: "investor",
    actorId: input.fanId,
    action: "DOCUMENT_ACK",
    entityType: "DisclosureAcceptance",
    details: { documentKey: input.documentKey, version: input.documentVersion, opportunityId: input.opportunityId },
    ipAddress: input.ipAddress,
  }).catch(() => {});
}

export type OrderRow = {
  id: string;
  amount: Prisma.Decimal;
  fees: Prisma.Decimal;
  currency: string;
  status: string;
  createdAt: Date;
  opportunity: { slug: string; name: string; status: string };
};

export async function listInvestorOrders(fanId: string): Promise<OrderRow[]> {
  const account = await prisma.investorAccount.findUnique({ where: { fanId } });
  if (!account) return [];
  return (await prisma.investmentOrder.findMany({
    where: { investorId: account.id },
    orderBy: { createdAt: "desc" },
    include: { opportunity: { select: { slug: true, name: true, status: true } } },
  })) as unknown as OrderRow[];
}

export type PositionRow = {
  id: string;
  amount: Prisma.Decimal;
  currency: string;
  status: string;
  acquiredAt: Date;
  currentValue: Prisma.Decimal | null;
  valuationStatus: string;
  opportunity: { id: string; slug: string; name: string; investmentType: string };
};

export async function listInvestorPositions(fanId: string): Promise<PositionRow[]> {
  const account = await prisma.investorAccount.findUnique({ where: { fanId } });
  if (!account) return [];
  return (await prisma.investmentPosition.findMany({
    where: { investorId: account.id },
    orderBy: { acquiredAt: "desc" },
    include: { opportunity: { select: { id: true, slug: true, name: true, investmentType: true } } },
  })) as unknown as PositionRow[];
}

export type TransactionRow = {
  txnRef: string;
  kind: string;
  direction: string;
  amount: Prisma.Decimal;
  currency: string;
  status: string;
  source: string;
  description: string | null;
  postedAt: Date | null;
  createdAt: Date;
};

export async function listInvestorTransactions(fanId: string): Promise<TransactionRow[]> {
  const account = await prisma.investorAccount.findUnique({ where: { fanId } });
  if (!account) return [];
  return (await prisma.transaction.findMany({
    where: { investorId: account.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  })) as unknown as TransactionRow[];
}