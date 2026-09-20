import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { postTransaction, settlePendingTransaction, cashAccount, buildBalancedEntries } from "./ledger";
import { getOrCreateInvestorAccount } from "./account";
import { validateInvestAmount, formatMoney } from "./mode";
import { auditLog, notifyInvestor } from "./audit";
import { createSubscription } from "./orders";
import { getActiveBankAccountForCurrency, type PublicBankAccount } from "@/lib/ticketing/banking";

/**
 * Investor deposits — paid by MANUAL Bank Transfer or ATM Deposit ONLY.
 *
 * The two channels (Bank Transfer and ATM Deposit) are fully separate: every
 * deposit intent, reference prefix, proof, pending status and admin queue is
 * method-specific so they can never be mixed up or approved across methods.
 *
 * This is the real-money path: no auto-credit, no card gateway, no simulation.
 *
 *   1. createDepositIntent creates a PENDING ledger Transaction for the chosen
 *      method — nothing is ever credited until an admin verifies a real receipt.
 *   2. The customer sees the method-specific instructions + destination account
 *      + a unique deposit reference (INVBT-… bank transfer / INVATM-… ATM).
 *   3. submitInvestDepositProof attaches a receipt (amount, reference, proof
 *      image) to that pending deposit → status PENDING_VERIFICATION.
 *   4. An admin reviews the actual receipt in the matching queue and APPROVES
 *      (settles the ledger credit, and subscribes the payment toward the chosen
 *      investment) or REJECTS (nothing moves).
 *
 * The frontend can never set a successful state — every credit originates
 * here, in the admin-reviewed path.
 */

export class InvestDepositError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const DEPOSIT_METHODS = ["bank-transfer", "atm-deposit"] as const;
export type DepositMethod = (typeof DEPOSIT_METHODS)[number];

/** Map a flow method to the stored proof.method discriminator. */
export function proofMethodFor(method: DepositMethod): string {
  return method === "atm-deposit" ? "ATM_DEPOSIT" : "BANK_TRANSFER";
}

export type DepositIntent = {
  mode: DepositMethod;
  method: DepositMethod;
  pendingTxnId: string;
  /** Reference the customer must quote on the transfer / ATM deposit. */
  depositRef: string;
  amount: string;
  currency: string;
  /** The admin-managed destination account to pay into (null when none configured). */
  bankAccount: PublicBankAccount | null;
  /** ATM deposit instructions (admin-configured) — null for Bank Transfer. */
  atmInstructions: string | null;
  opportunityId: string | null;
};

const METHOD_LABEL: Record<DepositMethod, string> = {
  "bank-transfer": "Bank Transfer",
  "atm-deposit": "ATM Deposit",
};

/**
 * Open a deposit intent for manual Bank Transfer or ATM Deposit.
 *
 * Validates the platform range ($100–$15,000,000) and (optionally) the target
 * opportunity's own limits, creates a PENDING ledger transaction stamped with
 * the chosen method and returns the unique reference + destination account.
 * Nothing credits.
 */
export async function createDepositIntent(input: {
  fanId: string;
  amount: Prisma.Decimal;
  method?: DepositMethod;
  opportunityId?: string | null;
  ipAddress?: string | null;
}): Promise<DepositIntent> {
  const method: DepositMethod = input.method ?? "bank-transfer";
  if (!DEPOSIT_METHODS.includes(method)) throw new InvestDepositError("INVALID", "Unknown deposit method.");

  const error = validateInvestAmount(input.amount);
  if (error) throw new InvestDepositError("AMOUNT_INVALID", error);

  if (input.opportunityId) {
    const opp = await prisma.investmentOpportunity.findUnique({ where: { id: input.opportunityId } });
    if (!opp) throw new InvestDepositError("NOT_FOUND", "Investment opportunity not found.");
    if (!["OPEN", "PENDING"].includes(opp.status)) {
      throw new InvestDepositError("NOT_OPEN", "This investment is not currently open to new subscriptions.");
    }
    const oppError = validateInvestAmount(input.amount, opp.minAmount, opp.maxAmount);
    if (oppError) throw new InvestDepositError("AMOUNT_INVALID", oppError);
  }

  const account = await getOrCreateInvestorAccount(input.fanId, input.ipAddress);

  const bankAccount = await getActiveBankAccountForCurrency("USD");
  if (!bankAccount) {
    throw new InvestDepositError("BANK_NOT_CONFIGURED", `${METHOD_LABEL[method]} isn't set up on this site yet. Please contact the team.`);
  }

  // PENDING deposit transaction FIRST — the ledger is only ever touched when an
  // admin approves the receipt (settlePendingTransaction below).
  const pending = await postTransaction({
    investorId: account.id,
    kind: "DEPOSIT",
    direction: "CREDIT",
    amount: input.amount,
    legs: [],
    pendingOnly: true,
    source: method,
    provider: method,
    description: `Deposit ${formatMoney(input.amount)} via ${METHOD_LABEL[method]}`,
  });

  // The method-specific reference the customer quotes. Stored as providerRef so
  // an approval can always map back to exactly this pending deposit.
  const depositRef = `${method === "atm-deposit" ? "INVATM" : "INVBT"}-${pending.txnRef}`;
  await prisma.transaction
    .update({ where: { id: pending.id }, data: { providerRef: depositRef } })
    .catch(() => undefined);

  await auditLog({
    actorType: "investor",
    actorId: input.fanId,
    action: "PAYMENT_PENDING",
    entityType: "Transaction",
    entityId: pending.id,
    details: { kind: "DEPOSIT", amount: input.amount.toFixed(2), method, depositRef },
    ipAddress: input.ipAddress,
  }).catch(() => {});

  const atmInstructions = method === "atm-deposit" ? await getAtmInstructionsForIntent() : null;

  return {
    mode: method,
    method,
    pendingTxnId: pending.id,
    depositRef,
    amount: input.amount.toFixed(2),
    currency: "USD",
    bankAccount,
    atmInstructions,
    opportunityId: input.opportunityId ?? null,
  };
}

/** Backwards-compatible name: open a Bank Transfer deposit intent. */
export async function createBankTransferDepositIntent(input: {
  fanId: string;
  amount: Prisma.Decimal;
  opportunityId?: string | null;
  ipAddress?: string | null;
}): Promise<DepositIntent> {
  return createDepositIntent({ ...input, method: "bank-transfer" });
}

async function getAtmInstructionsForIntent(): Promise<string | null> {
  try {
    const { getAtmInstructions } = await import("./atm");
    return await getAtmInstructions();
  } catch {
    return null;
  }
}

// ===== Customer receipt submission =====

/** Server-side shape validation of the customer-submitted receipt. */
function validateProofShape(input: {
  amountCents: number;
  fileUrl?: string | null;
  mimeType?: string | null;
  reference?: string | null;
}): string | null {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return "Please enter a valid transfer amount.";
  }
  if (input.fileUrl && (typeof input.fileUrl !== "string" || input.fileUrl.length > 2_500_000)) {
    return "Uploaded proof is too large.";
  }
  if (input.fileUrl && !input.fileUrl.startsWith("data:image/")) {
    return "The proof must be an image upload.";
  }
  if (input.mimeType && !/^image\//.test(input.mimeType)) {
    return "The proof must be an image upload.";
  }
  if (input.reference && String(input.reference).trim().length > 120) {
    return "That reference is too long.";
  }
  return null;
}

/**
 * Attach a bank-transfer/ATM receipt to a pending investor deposit. The deposit
 * never credits here — it stays PENDING_VERIFICATION until an admin confirms
 * the actual receipt. The method is locked to the deposit's own method so a
 * Bank Transfer receipt can never be posted onto an ATM deposit (or vice versa).
 */
export async function submitInvestDepositProof(input: {
  fanId: string;
  txnId: string;
  method?: DepositMethod;
  senderName?: string | null;
  reference?: string | null;
  transferDate?: string | null;
  amountCents: number;
  currency?: string | null;
  bankAccountId?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  opportunityId?: string | null;
  ipAddress?: string | null;
}): Promise<{ proofId: string; status: string }> {
  const txn = await prisma.transaction.findUnique({ where: { id: input.txnId } });
  if (!txn) throw new InvestDepositError("NOT_FOUND", "Deposit not found.");
  if (txn.kind !== "DEPOSIT") throw new InvestDepositError("INVALID", "This reference is not a deposit.");
  if (!["INITIATED", "PENDING"].includes(txn.status)) {
    if (txn.status === "SUCCESSFUL") {
      throw new InvestDepositError("ALREADY_PAID", "This deposit is already confirmed. Nothing more to upload.");
    }
    throw new InvestDepositError("INVALID", `This deposit is ${txn.status.toLowerCase()} and can no longer be submitted.`);
  }

  // Method lock: the deposit was created for exactly one channel; the customer
  // may only submit a receipt for that same method.
  const method: DepositMethod = txn.provider === "atm-deposit" ? "atm-deposit" : "bank-transfer";
  if (input.method && input.method !== method) {
    throw new InvestDepositError(
      "METHOD_MISMATCH",
      `This deposit is for ${METHOD_LABEL[method]}. Please submit its receipt from the ${METHOD_LABEL[method]} flow.`,
    );
  }

  const account = await prisma.investorAccount.findUnique({
    where: { id: txn.investorId },
    select: { fanId: true },
  });
  if (!account || account.fanId !== input.fanId) {
    throw new InvestDepositError("NOT_FOUND", "Deposit not found.");
  }

  const shapeError = validateProofShape(input);
  if (shapeError) throw new InvestDepositError("INVALID_PROOF", shapeError);

  // The receipt amount must match the deposit exactly (real penny-precision).
  const wantedCents = Math.round(txn.amount.toNumber() * 100);
  if (input.amountCents !== wantedCents) {
    throw new InvestDepositError("AMOUNT_MISMATCH", `This receipt is for ${(input.amountCents / 100).toFixed(2)} but the deposit is ${formatMoney(txn.amount)}. Correct the amount so it matches.`);
  }

  // Guard against several duplicate receipts on the same pending deposit.
  const previous = await prisma.bankTransferProof.findFirst({
    where: { transactionId: txn.id, status: "PENDING_VERIFICATION" },
    select: { id: true },
  });
  if (previous) {
    throw new InvestDepositError("ALREADY_SUBMITTED", "A receipt is already waiting for this deposit. Our team will review it shortly.");
  }

  const proof = await prisma.bankTransferProof.create({
    data: {
      bankAccountId: input.bankAccountId ?? null,
      amountCents: input.amountCents,
      currency: (input.currency ?? "USD").toUpperCase(),
      senderName: input.senderName?.trim() || null,
      reference: input.reference?.trim() || null,
      transferDate: input.transferDate ? new Date(input.transferDate) : null,
      fileName: input.fileName || null,
      fileUrl: input.fileUrl || null,
      mimeType: input.mimeType || null,
      method: proofMethodFor(method),
      status: "PENDING_VERIFICATION",
      transactionId: txn.id,
      opportunityId: input.opportunityId ? await resolveFriendlyOpportunity(input.opportunityId) : null,
    },
  });

  await auditLog({
    actorType: "investor",
    actorId: input.fanId,
    action: "PROOF_SUBMITTED",
    entityType: "BankTransferProof",
    entityId: proof.id,
    details: { kind: "DEPOSIT", method, amountCents: input.amountCents, depositRef: txn.providerRef, txnId: txn.id },
    ipAddress: input.ipAddress,
  }).catch(() => {});

  void notifyDepositProofSubmitted({
    fanId: input.fanId,
    method,
    amountCents: input.amountCents,
    currency: (input.currency ?? "USD").toUpperCase(),
  });

  return { proofId: proof.id, status: "PENDING_VERIFICATION" };
}

/** Only link a proof to an opportunity ID that actually exists. */
async function resolveFriendlyOpportunity(opportunityId: string): Promise<string | null> {
  const opp = await prisma.investmentOpportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true },
  });
  return opp ? opp.id : null;
}

/** Fire-and-forget notifications: admins get pinged to the verify queue. */
async function notifyDepositProofSubmitted(args: { fanId: string; method: DepositMethod; amountCents: number; currency: string }) {
  try {
    const [{ notifyAdminBankTransferPending }, adminEmails] = await Promise.all([
      import("../emails"),
      import("@/lib/admin/settings").then((m) => m.getAdminEmails()),
    ]);
    if (adminEmails.length) {
      void notifyAdminBankTransferPending({
        to: adminEmails,
        amountCents: args.amountCents,
        currency: args.currency,
        senderName: "Investor",
        reference: `${METHOD_LABEL[args.method]} deposit`,
        bankAccount: `${args.currency} · ${METHOD_LABEL[args.method]}`,
        purchase: "investor deposit (awaiting verification)",
        verifyUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/admin/invest/deposits?method=${args.method}`,
      });
    }
  } catch (err) {
    console.error("[invest-deposit] admin notification failed", err);
  }
}

// ===== Admin verification =====

export type DepositProofRow = {
  id: string;
  method: string;
  amountCents: number;
  currency: string;
  senderName: string | null;
  reference: string | null;
  transferDate: string | null;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  bankAccountCurrency: string | null;
  bankAccountCountry: string | null;
  investorNumber: string | null;
  fanName: string | null;
  fanEmail: string | null;
  depositRef: string | null;
  txnRef: string | null;
  txnStatus: string | null;
  opportunityName: string | null;
  opportunitySlug: string | null;
};

function serializeDepositProof(row: {
  id: string;
  method: string;
  amountCents: number;
  currency: string;
  senderName: string | null;
  reference: string | null;
  transferDate: Date | null;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  status: string;
  adminNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  bankAccount: { currency: string; countryName: string } | null;
  transaction: { txnRef: string; providerRef: string | null; status: string; investor: { investorNumber: string; fan: { name: string | null; email: string | null } } } | null;
  opportunity: { name: string; slug: string } | null;
}): DepositProofRow {
  return {
    id: row.id,
    method: row.method,
    amountCents: row.amountCents,
    currency: row.currency,
    senderName: row.senderName,
    reference: row.reference,
    transferDate: row.transferDate ? row.transferDate.toISOString() : null,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    mimeType: row.mimeType,
    status: row.status,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    bankAccountCurrency: row.bankAccount?.currency ?? null,
    bankAccountCountry: row.bankAccount?.countryName ?? null,
    investorNumber: row.transaction?.investor.investorNumber ?? null,
    fanName: row.transaction?.investor.fan.name ?? null,
    fanEmail: row.transaction?.investor.fan.email ?? null,
    depositRef: row.transaction?.providerRef ?? null,
    txnRef: row.transaction?.txnRef ?? null,
    txnStatus: row.transaction?.status ?? null,
    opportunityName: row.opportunity?.name ?? null,
    opportunitySlug: row.opportunity?.slug ?? null,
  };
}

/**
 * All investor deposit proofs, newest first. When `method` is given, only that
 * single channel is returned (BANK_TRANSFER or ATM_DEPOSIT) so the admin queues
 * stay permanently separate.
 */
export async function listPendingInvestDepositProofs(method?: DepositMethod): Promise<DepositProofRow[]> {
  const rows = await prisma.bankTransferProof.findMany({
    where: {
      status: { in: ["PENDING_VERIFICATION", "APPROVED", "REJECTED"] },
      transactionId: { not: null },
      ...(method ? { method: proofMethodFor(method) } : {}),
    },
    include: {
      bankAccount: { select: { currency: true, countryName: true } },
      transaction: {
        select: {
          txnRef: true,
          providerRef: true,
          status: true,
          investor: {
            select: {
              investorNumber: true,
              fan: { select: { name: true, email: true } },
            },
          },
        },
      },
      opportunity: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeDepositProof);
}

export async function getInvestDepositProof(proofId: string): Promise<DepositProofRow | null> {
  const row = await prisma.bankTransferProof.findUnique({
    where: { id: proofId },
    include: {
      bankAccount: { select: { currency: true, countryName: true } },
      transaction: {
        select: {
          txnRef: true,
          providerRef: true,
          status: true,
          investor: {
            select: {
              investorNumber: true,
              fan: { select: { name: true, email: true } },
            },
          },
        },
      },
      opportunity: { select: { name: true, slug: true } },
    },
  });
  if (!row || !row.transactionId) return null;
  return serializeDepositProof(row);
}

export type DepositDecisionResult =
  | { ok: true; status: string; credited: boolean; subscribed: boolean }
  | { ok: false; status: number; message: string };

/**
 * Admin approves an invest deposit: settle the pending ledger credit (real
 * money confirmed) and — when the deposit was for a specific investment —
 * subscribe the investor automatically. Idempotent: a proof already decided or
 * a transaction already settled is never double-credited. `method` locks the
 * decision to the matching queue so the wrong payment method can never be
 * approved.
 */
export async function approveInvestDeposit(args: {
  proofId: string;
  adminNote?: string | null;
  method?: DepositMethod;
}): Promise<DepositDecisionResult> {
  const proof = await prisma.bankTransferProof.findUnique({
    where: { id: args.proofId },
    include: { transaction: true, opportunity: { select: { id: true, slug: true } } },
  });
  if (!proof) return { ok: false, status: 404, message: "Deposit proof not found." };
  if (proof.status !== "PENDING_VERIFICATION") {
    return { ok: false, status: 409, message: `This proof was already ${proof.status.toLowerCase()}.` };
  }
  if (args.method && proof.method !== proofMethodFor(args.method)) {
    return { ok: false, status: 400, message: "This proof is not in the queue you opened. Refresh and review it from the correct deposit queue." };
  }
  if (!proof.transactionId || !proof.transaction) {
    return { ok: false, status: 400, message: "This proof is not linked to a deposit." };
  }

  const methodLabel = proof.method === "ATM_DEPOSIT" ? "ATM deposit" : "bank transfer";
  const txn = proof.transaction;
  if (txn.status === "FAILED" || txn.status === "CANCELLED" || txn.status === "REFUNDED" || txn.status === "REVERSED") {
    return { ok: false, status: 409, message: `This deposit is ${txn.status.toLowerCase()} and cannot be approved.` };
  }

  const settleResult = await settlePendingTransaction({
    txnId: txn.id,
    legs: buildBalancedEntries([
      { account: cashAccount(txn.investorId), amount: txn.amount },
      { account: "platform:liability", amount: txn.amount.negated() },
    ]),
    providerRef: txn.providerRef ?? undefined,
    description: `Deposit confirmed via ${methodLabel} (${formatMoney(txn.amount)})`,
  });
  if (settleResult === "not-found") return { ok: false, status: 500, message: "Deposit transaction was not found." };
  const credited = settleResult === "settled";

  const now = new Date();
  await prisma.bankTransferProof.update({
    where: { id: proof.id },
    data: { status: "APPROVED", adminNote: args.adminNote ?? null, reviewedAt: now },
  });

  await auditLog({
    actorType: "admin",
    actorId: undefined,
    action: "PAYMENT_CONFIRMED",
    entityType: "BankTransferProof",
    entityId: proof.id,
    details: { kind: "DEPOSIT", amount: txn.amount.toFixed(2), method: proof.method, depositRef: txn.providerRef, credited },
  }).catch(() => {});
  await notifyInvestor({
    investorId: txn.investorId,
    type: "PAYMENT_CONFIRMED",
    title: "Deposit confirmed",
    body: `${formatMoney(txn.amount)} was credited to your investor account (${txn.providerRef ?? methodLabel}).`,
  }).catch(() => {});

  // Subscribe the deposit toward the opportunity it was paying for (if any).
  let subscribed = false;
  if (proof.opportunityId && credited) {
    try {
      const account = await prisma.investorAccount.findUnique({
        where: { id: txn.investorId },
        select: { fanId: true },
      });
      if (account && proof.opportunity) {
        await createSubscription({
          fanId: account.fanId,
          opportunitySlug: proof.opportunity.slug,
          amount: txn.amount,
        });
        subscribed = true;
      }
    } catch (err) {
      // Cash is already credited. The investor can subscribe manually from
      // their investor hub — never silently lose real money.
      console.error("[invest-deposit] auto-subscribe failed:", err);
    }
  }

  return { ok: true, status: "APPROVED", credited, subscribed };
}

/** Admin rejects an invest deposit: nothing credits, the pending txn is closed. */
export async function rejectInvestDeposit(args: {
  proofId: string;
  adminNote?: string | null;
  method?: DepositMethod;
}): Promise<DepositDecisionResult> {
  const proof = await prisma.bankTransferProof.findUnique({
    where: { id: args.proofId },
    include: { transaction: { select: { id: true, investorId: true, amount: true } } },
  });
  if (!proof) return { ok: false, status: 404, message: "Deposit proof not found." };
  if (proof.status !== "PENDING_VERIFICATION") {
    return { ok: false, status: 409, message: `This proof was already ${proof.status.toLowerCase()}.` };
  }
  if (args.method && proof.method !== proofMethodFor(args.method)) {
    return { ok: false, status: 400, message: "This proof is not in the queue you opened. Refresh and review it from the correct deposit queue." };
  }

  await prisma.bankTransferProof.update({
    where: { id: proof.id },
    data: { status: "REJECTED", adminNote: args.adminNote ?? null, reviewedAt: new Date() },
  });

  if (proof.transactionId) {
    await prisma.transaction
      .update({
        where: { id: proof.transactionId },
        data: { status: "CANCELLED" },
      })
      .catch(() => undefined);
  }

  const methodLabel = proof.method === "ATM_DEPOSIT" ? "ATM deposit" : "Bank Transfer deposit";
  if (proof.transaction) {
    await auditLog({
      actorType: "admin",
      actorId: undefined,
      action: "PAYMENT_REJECTED",
      entityType: "BankTransferProof",
      entityId: proof.id,
      details: { kind: "DEPOSIT", amount: proof.transaction.amount.toFixed(2), method: proof.method, note: args.adminNote ?? null },
    }).catch(() => {});
    await notifyInvestor({
      investorId: proof.transaction.investorId,
      type: "PAYMENT_REJECTED",
      title: "Deposit not confirmed",
      body: args.adminNote
        ? `Your ${methodLabel} could not be confirmed: ${args.adminNote}`
        : `Your ${methodLabel} could not be confirmed. Please contact support.`,
    }).catch(() => {});
  }

  return { ok: true, status: "REJECTED", credited: false, subscribed: false };
}