import { prisma } from "@/lib/db";
import { getOrCreateInvestorAccount, type InvestorAccountView } from "./account";
import { auditLog } from "./audit";
import { InvestError } from "./orders";

/**
 * KYC state machine. Nothing is ever auto-verified: a VERIFIED state only
 * exists after an administrator (or, in live mode, a verified identity
 * provider) records the decision. Documents are stored as secure references —
 * file bytes never live in the DB and are never returned to the client.
 */

export const KYC_STATUSES = ["NOT_STARTED", "PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "ADDITIONAL_INFORMATION_REQUIRED"] as const;

export async function submitKyc(input: {
  fanId: string;
  legalFullName: string;
  documentType: string;
  country: string;
  dateOfBirth?: string | null;
  documentRef?: string | null; // reference to the securely stored upload
  ipAddress?: string | null;
}) {
  const name = String(input.legalFullName ?? "").trim();
  const docType = String(input.documentType ?? "").trim();
  const country = String(input.country ?? "").trim();
  if (!name || !docType || !country) {
    throw new InvestError("BAD_REQUEST", "Full legal name, document type and country are required.");
  }
  const account = await getOrCreateInvestorAccount(input.fanId, input.ipAddress);
  const existing = await prisma.kycRecord.findUnique({ where: { investorId: account.id } });

  const record = existing
    ? await prisma.kycRecord.update({
        where: { investorId: account.id },
        data: {
          status: "PENDING",
          legalFullName: name,
          documentType: docType,
          country,
          dateOfBirth: input.dateOfBirth ?? null,
          documentRef: input.documentRef ?? null,
          submittedAt: new Date(),
          reviewNote: null,
        },
      })
    : await prisma.kycRecord.create({
        data: {
          investorId: account.id,
          status: "PENDING",
          legalFullName: name,
          documentType: docType,
          country,
          dateOfBirth: input.dateOfBirth ?? null,
          documentRef: input.documentRef ?? null,
          submittedAt: new Date(),
        },
      });

  await prisma.investorAccount.update({
    where: { id: account.id },
    data: { kycStatus: "PENDING", country },
  });

  await auditLog({
    actorType: "investor",
    actorId: input.fanId,
    action: "KYC_SUBMITTED",
    entityType: "KycRecord",
    entityId: record.id,
    details: { documentType: docType },
    ipAddress: input.ipAddress,
  }).catch(() => {});

  return { kycStatus: "PENDING" };
}

export async function decideKyc(input: {
  investorId: string;
  decision: "VERIFIED" | "REJECTED" | "ADDITIONAL_INFORMATION_REQUIRED";
  adminEmail: string;
  note?: string | null;
}) {
  const account = await prisma.investorAccount.findUnique({ where: { id: input.investorId } });
  if (!account) throw new InvestError("NOT_FOUND", "Investor account not found.");
  const record = await prisma.kycRecord.findUnique({ where: { investorId: account.id } });
  if (!record) throw new InvestError("BAD_REQUEST", "No KYC submission exists to review.");

  await prisma.kycRecord.update({
    where: { investorId: account.id },
    data: { status: input.decision, reviewedById: input.adminEmail, reviewedAt: new Date(), reviewNote: input.note ?? null },
  });
  await prisma.investorAccount.update({
    where: { id: account.id },
    data: {
      kycStatus: input.decision,
      // Recording a real decision may clear a stale bank-review flag.
      ...(input.decision === "VERIFIED" ? { riskFlag: null, riskFlagReason: null } : {}),
    },
  });

  await auditLog({
    actorType: "admin",
    actorId: input.adminEmail,
    action: "KYC_DECISION",
    entityType: "InvestorAccount",
    entityId: account.id,
    details: { decision: input.decision, note: input.note },
  }).catch(() => {});

  return { kycStatus: input.decision };
}

/** Admin-only view of all investors + KYC state (no PII beyond what's required). */
export async function listAdminInvestors(): Promise<
  Array<InvestorAccountView & { email: string; kycLegalName: string | null; submittedAt: Date | null }>
> {
  const rows = await prisma.investorAccount.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fan: { select: { email: true } },
      kyc: { select: { legalFullName: true, submittedAt: true } },
    },
  });
  return rows.map((r) => ({
    ...toAccountView(r),
    email: r.fan.email,
    kycLegalName: r.kyc?.legalFullName ?? null,
    submittedAt: r.kyc?.submittedAt ?? null,
  }));
}

function toAccountView(row: {
  id: string;
  fanId: string;
  investorNumber: string;
  legalFullName: string | null;
  country: string | null;
  kycStatus: string;
  accountStatus: string;
  riskFlag: string | null;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}): InvestorAccountView {
  return {
    id: row.id,
    fanId: row.fanId,
    investorNumber: row.investorNumber,
    legalFullName: row.legalFullName,
    country: row.country,
    kycStatus: row.kycStatus,
    accountStatus: row.accountStatus,
    riskFlag: row.riskFlag,
    isDemo: row.isDemo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}