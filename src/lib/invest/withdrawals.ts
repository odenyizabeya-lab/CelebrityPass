import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { postTransaction, cashAccount } from "./ledger";
import { wdrRefFromSeq, nextWdrSeq } from "./refs";
import { getOrCreateInvestorAccount } from "./account";
import { validateInvestAmount, isDemoMode, formatMoney } from "./mode";
import { auditLog, raiseComplianceAlert, notifyInvestor } from "./audit";
import { InvestError } from "./orders";

/**
 * Withdrawal lifecycle: REQUESTED → UNDER_REVIEW → APPROVED/REJECTED →
 * PROCESSING → COMPLETED/FAILED. Only the backend moves states, and COMPLETED
 * only after the (demo) provider confirms the outbound transfer.
 */

export async function requestWithdrawal(input: {
  fanId: string;
  amountValue: unknown;
  destinationLabel?: string | null;
  ipAddress?: string | null;
}) {
  // Amount re-parsed server-side; the client value is never trusted.
  const raw = String(input.amountValue ?? "").trim();
  const amount = /^\d+(\.\d{1,2})?$/.test(raw) ? new Prisma.Decimal(raw) : null;
  if (!amount) throw new InvestError("AMOUNT_INVALID", "Enter a valid amount.");
  const err = validateInvestAmount(amount);
  if (err) throw new InvestError("AMOUNT_INVALID", err);

  const account = await getOrCreateInvestorAccount(input.fanId, input.ipAddress);
  const agg = await prisma.ledgerEntry.aggregate({
    where: { account: cashAccount(account.id) },
    _sum: { amount: true },
  });
  const cash = new Prisma.Decimal(agg._sum.amount ?? 0);
  if (cash.lessThan(amount)) {
    throw new InvestError("INSUFFICIENT_FUNDS", `Insufficient withdrawable balance (available ${formatMoney(cash.isNegative() ? 0 : cash)}).`);
  }
  if (account.kycStatus !== "VERIFIED") {
    throw new InvestError("KYC_REQUIRED", "Identity verification (KYC) is required before any withdrawal can be processed.");
  }

  const seq = await nextWdrSeq();
  const wd = await prisma.withdrawal.create({
    data: {
      ref: wdrRefFromSeq(seq),
      investorId: account.id,
      amount,
      status: "REQUESTED",
      destinationJson: input.destinationLabel ? JSON.stringify({ label: String(input.destinationLabel).slice(0, 120) }) : null,
    },
  });

  await auditLog({
    actorType: "investor",
    actorId: input.fanId,
    action: "WITHDRAWAL_REQUESTED",
    entityType: "Withdrawal",
    entityId: wd.id,
    details: { amount: amount.toFixed(2) },
    ipAddress: input.ipAddress,
  }).catch(() => {});
  await raiseComplianceAlert({
    investorId: account.id,
    level: amount.gte(50_000) ? "HIGH" : "MEDIUM",
    ruleKey: "WITHDRAWAL_REVIEW",
    message: amount.gte(50_000) ? "Large withdrawal — manual compliance review required." : "Withdrawal requires review before processing.",
  }).catch(() => {});
  await notifyInvestor({
    investorId: account.id,
    type: "WITHDRAWAL_REQUESTED",
    title: "Withdrawal requested",
    body: `Your withdrawal of ${formatMoney(amount)} is queued for review.`,
  }).catch(() => {});

  return wd;
}

/** Admin review: APPROVE (→ PROCESSING) or REJECT. Note: REQUESTED → APPROVED → PROCESSING. */
export async function reviewWithdrawal(input: {
  withdrawalId: string;
  decision: "APPROVE" | "REJECT";
  adminEmail: string;
  note?: string | null;
}) {
  const wd = await prisma.withdrawal.findUnique({ where: { id: input.withdrawalId } });
  if (!wd) throw new InvestError("NOT_FOUND", "Withdrawal not found.");
  if (input.decision === "REJECT") {
    await prisma.withdrawal.update({
      where: { id: wd.id },
      data: { status: "REJECTED", reviewNote: input.note ?? null, approvedById: input.adminEmail, approvedAt: new Date() },
    });
    await auditLog({
      actorType: "admin",
      actorId: input.adminEmail,
      action: "WITHDRAWAL_REJECTED",
      entityType: "Withdrawal",
      entityId: wd.id,
      details: { ref: wd.ref, note: input.note },
    }).catch(() => {});
    await notifyInvestor({
      investorId: wd.investorId,
      type: "WITHDRAWAL_REJECTED",
      title: "Withdrawal rejected",
      body: input.note ?? "Your withdrawal request was not approved.",
    }).catch(() => {});
    return { ok: true, status: "REJECTED" };
  }

  // APPROVE: only from REQUESTED; matches the recorded lifecycle.
  await prisma.withdrawal.update({
    where: { id: wd.id },
    data: { status: "PROCESSING", reviewNote: input.note ?? wd.reviewNote, approvedById: input.adminEmail, approvedAt: new Date() },
  });
  await auditLog({
    actorType: "admin",
    actorId: input.adminEmail,
    action: "WITHDRAWAL_APPROVED",
    entityType: "Withdrawal",
    entityId: wd.id,
    details: { ref: wd.ref },
  }).catch(() => {});
  await notifyInvestor({
    investorId: wd.investorId,
    type: "WITHDRAWAL_PROCESSING",
    title: "Withdrawal in progress",
    body: "Your withdrawal is being processed by the payout provider.",
  }).catch(() => {});
  return { ok: true, status: "PROCESSING" };
}

/**
 * Complete a withdrawal (demo provider confirmation). Posts the debit to the
 * cash ledger with balanced entries and marks the withdrawal COMPLETED — one
 * atomic operation, so the ledger and the status can never disagree. A unique
 * gateway event id makes repeated attempts idempotent.
 */
export async function completeWithdrawal(input: { withdrawalId: string; adminEmail: string; gatewayRef?: string | null }) {
  const wd = await prisma.withdrawal.findUnique({ where: { id: input.withdrawalId } });
  if (!wd) throw new InvestError("NOT_FOUND", "Withdrawal not found.");
  if (wd.status === "COMPLETED") return { ok: true, status: "COMPLETED", ref: wd.ref };

  const demo = await isDemoMode();
  const gatewayId = `demo-withdraw:${wd.id}`;

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Withdrawal" WHERE id = ${wd.id} FOR UPDATE`;
      const withdrawal = await tx.withdrawal.findUnique({ where: { id: wd.id } });
      const allowed = withdrawal && !["COMPLETED", "REJECTED", "FAILED"].includes(withdrawal.status);
      if (!withdrawal || !allowed) return;
      const txn = await postTransaction(
        {
          investorId: withdrawal.investorId,
          kind: "WITHDRAWAL",
          direction: "DEBIT",
          amount: withdrawal.amount,
          legs: [
            { account: cashAccount(withdrawal.investorId), amount: withdrawal.amount.negated() },
            { account: "platform:liability", amount: withdrawal.amount },
          ],
          source: demo ? "demo-provider" : "bank-provider",
          gatewayEventId: gatewayId,
          providerRef: demo ? `demo:${gatewayId}` : input.gatewayRef ?? null,
          provider: demo ? "demo" : "bank",
          withdrawalId: withdrawal.id,
          description: `Withdrawal ${withdrawal.ref}`,
        },
        tx,
      );
      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "COMPLETED", transaction: { connect: { id: txn.id } } },
      });
      await tx.investNotification.create({
        data: {
          investorId: withdrawal.investorId,
          type: "WITHDRAWAL_COMPLETED",
          title: "Withdrawal completed",
          body: `Your withdrawal ${withdrawal.ref} of ${formatMoney(withdrawal.amount)} has been paid out.`,
        },
      });
    },
    { maxWait: 10000, timeout: 30000 },
  );

  await auditLog({
    actorType: "admin",
    actorId: input.adminEmail,
    action: "WITHDRAWAL_COMPLETED",
    entityType: "Withdrawal",
    entityId: wd.id,
    details: { ref: wd.ref, gatewayRef: input.gatewayRef ?? null },
  }).catch(() => {});

  return { ok: true, status: "COMPLETED", ref: wd.ref };
}