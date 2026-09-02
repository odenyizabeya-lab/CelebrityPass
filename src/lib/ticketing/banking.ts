/**
 * Admin-managed bank accounts for Bank Transfer payments.
 *
 * Customers who choose "Bank Transfer" are shown the correct bank account for
 * the selected currency, styled like a real banking app, with Copy buttons and
 * a "we verify transfers" notice. All accounts shown are created/edited/removed
 * by the admin via the admin panel — nothing here is hardcoded.
 *
 * NO payment is ever marked paid on the customer's word alone: every Bank
 * Transfer payment carries a BankTransferProof that stays PENDING_VERIFICATION
 * until an admin reviews real receipt/proof in the admin queue.
 */

import { prisma } from "@/lib/db";
import type { BankAccount } from "@prisma/client";

// A sorted, safe shape we expose to customers (only display fields — never
// envKeyRef/internal notes that could hint at config).
export type PublicBankAccount = {
  id: string;
  currency: string;
  countryName: string;
  countryFlag: string | null;
  beneficiary: string;
  bankName: string;
  accountType: string | null;
  accountNumber: string | null;
  iban: string | null;
  bic: string | null;
  swift: string | null;
  routing: string | null;
  sortCode: string | null;
  institutionNumber: string | null;
  transitNumber: string | null;
  branchCode: string | null;
  bankCode: string | null;
  transferType: string;
  bankAddress: string | null;
};

function toPublicAccount(a: BankAccount): PublicBankAccount {
  return {
    id: a.id,
    currency: a.currency.toUpperCase(),
    countryName: a.countryName,
    countryFlag: a.countryFlag,
    beneficiary: a.beneficiary,
    bankName: a.bankName,
    accountType: a.accountType,
    accountNumber: a.accountNumber,
    iban: a.iban,
    bic: a.bic,
    swift: a.swift,
    routing: a.routing,
    sortCode: a.sortCode,
    institutionNumber: a.institutionNumber,
    transitNumber: a.transitNumber,
    branchCode: a.branchCode,
    bankCode: a.bankCode,
    transferType: a.transferType,
    bankAddress: a.bankAddress,
  };
}

/** All active bank accounts for public/customer-facing display, sorted. */
export async function listActiveBankAccounts(): Promise<PublicBankAccount[]> {
  const rows = await prisma.bankAccount.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { currency: "asc" }],
  });
  return rows.map(toPublicAccount);
}

/** The active bank account for a currency, or null when the admin has none. */
export async function getActiveBankAccountForCurrency(
  currency: string | null | undefined,
): Promise<PublicBankAccount | null> {
  const code = (currency ?? "USD").toUpperCase();
  const row = await prisma.bankAccount.findFirst({
    where: { currency: code, isActive: true },
    orderBy: { displayOrder: "asc" },
  });
  return row ? toPublicAccount(row) : null;
}

/** Group available bank accounts by currency for a checkout method picker. */
export async function listBankAccountCurrencies(): Promise<{ currency: string; countryName: string; countryFlag: string | null }[]> {
  const rows = await prisma.bankAccount.findMany({
    where: { isActive: true },
    select: { currency: true, countryName: true, countryFlag: true },
    orderBy: [{ displayOrder: "asc" }, { currency: "asc" }],
  });
  return rows.map((r) => ({ currency: r.currency.toUpperCase(), countryName: r.countryName, countryFlag: r.countryFlag }));
}

// ===== Admin-facing =====

export type AdminBankAccount = PublicBankAccount & {
  isActive: boolean;
  displayOrder: number;
  envKeyRef: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function toAdminAccount(a: BankAccount): AdminBankAccount {
  return {
    ...toPublicAccount(a),
    isActive: a.isActive,
    displayOrder: a.displayOrder,
    envKeyRef: a.envKeyRef,
    notes: a.notes,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export async function listAllBankAccounts(): Promise<AdminBankAccount[]> {
  const rows = await prisma.bankAccount.findMany({
    orderBy: [{ displayOrder: "asc" }, { currency: "asc" }],
  });
  return rows.map(toAdminAccount);
}

/** Create or fully replace a bank account for a currency. */
export async function upsertBankAccount(data: {
  currency: string;
  countryName: string;
  countryFlag?: string | null;
  beneficiary: string;
  bankName: string;
  accountType?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  bic?: string | null;
  swift?: string | null;
  routing?: string | null;
  sortCode?: string | null;
  institutionNumber?: string | null;
  transitNumber?: string | null;
  branchCode?: string | null;
  bankCode?: string | null;
  transferType?: string;
  bankAddress?: string | null;
  isActive?: boolean;
  displayOrder?: number;
  envKeyRef?: string | null;
  notes?: string | null;
}): Promise<AdminBankAccount> {
  const currency = data.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a 3-letter code like USD");
  if (!data.beneficiary.trim()) throw new Error("beneficiary is required");
  if (!data.bankName.trim()) throw new Error("bankName is required");

  const account = await prisma.bankAccount.upsert({
    where: { currency },
    create: {
      currency,
      countryName: data.countryName.trim(),
      countryFlag: data.countryFlag ?? null,
      beneficiary: data.beneficiary.trim(),
      bankName: data.bankName.trim(),
      accountType: data.accountType ?? null,
      accountNumber: data.accountNumber ?? null,
      iban: data.iban ?? null,
      bic: data.bic ?? null,
      swift: data.swift ?? null,
      routing: data.routing ?? null,
      sortCode: data.sortCode ?? null,
      institutionNumber: data.institutionNumber ?? null,
      transitNumber: data.transitNumber ?? null,
      branchCode: data.branchCode ?? null,
      bankCode: data.bankCode ?? null,
      transferType: data.transferType ?? "Local transfer",
      bankAddress: data.bankAddress ?? null,
      isActive: data.isActive ?? true,
      displayOrder: data.displayOrder ?? 0,
      envKeyRef: data.envKeyRef ?? null,
      notes: data.notes ?? null,
    },
    update: {
      countryName: data.countryName.trim(),
      countryFlag: data.countryFlag ?? null,
      beneficiary: data.beneficiary.trim(),
      bankName: data.bankName.trim(),
      accountType: data.accountType ?? null,
      accountNumber: data.accountNumber ?? null,
      iban: data.iban ?? null,
      bic: data.bic ?? null,
      swift: data.swift ?? null,
      routing: data.routing ?? null,
      sortCode: data.sortCode ?? null,
      institutionNumber: data.institutionNumber ?? null,
      transitNumber: data.transitNumber ?? null,
      branchCode: data.branchCode ?? null,
      bankCode: data.bankCode ?? null,
      transferType: data.transferType ?? "Local transfer",
      bankAddress: data.bankAddress ?? null,
      isActive: data.isActive ?? true,
      displayOrder: data.displayOrder ?? 0,
      envKeyRef: data.envKeyRef ?? null,
      notes: data.notes ?? null,
    },
  });
  return toAdminAccount(account);
}

// ===== Bank Transfer proofs =====

export const PROOF_STATUS = {
  PENDING: "PENDING_VERIFICATION",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type ProofStatus = (typeof PROOF_STATUS)[keyof typeof PROOF_STATUS];

export type BankTransferProofPayload = {
  id: string;
  amountCents: number;
  currency: string;
  senderName: string | null;
  reference: string | null;
  transferDate: string | null;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  status: ProofStatus;
  adminNote: string | null;
  createdAt: string;
  bankAccountCurrency: string | null;
  bankAccountCountry: string | null;
};

export function serializeProof(p: {
  id: string;
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
  bankAccount?: { currency: string; countryName: string } | null;
}): BankTransferProofPayload {
  return {
    id: p.id,
    amountCents: p.amountCents,
    currency: p.currency,
    senderName: p.senderName,
    reference: p.reference,
    transferDate: p.transferDate ? p.transferDate.toISOString() : null,
    fileName: p.fileName,
    fileUrl: p.fileUrl,
    mimeType: p.mimeType,
    status: p.status as ProofStatus,
    adminNote: p.adminNote,
    createdAt: p.createdAt.toISOString(),
    bankAccountCurrency: p.bankAccount?.currency ?? null,
    bankAccountCountry: p.bankAccount?.countryName ?? null,
  };
}