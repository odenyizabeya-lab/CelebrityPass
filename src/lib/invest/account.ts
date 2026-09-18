import { prisma } from "@/lib/db";
import { investorNumberFromSeq, nextInvestorSeq } from "./refs";
import { auditLog } from "./audit";

/**
 * One investor account linked to an existing fan login. Creating one never
 * implies KYC, verification or any status — every state is earned later by a
 * real recorded event.
 */
export type InvestorAccountView = {
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
};

export function toInvestorView(row: {
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

/** Fetch the fan's investor account, or null when they never opened one. */
export async function getInvestorAccountByFan(fanId: string) {
  const row = await prisma.investorAccount.findUnique({
    where: { fanId },
    include: { kyc: true },
  });
  return row;
}

/**
 * Get (or create) the investor account for a fan. Account number is only
 * allocated on first open; creation is recorded in the audit trail.
 */
export async function getOrCreateInvestorAccount(fanId: string, ipAddress?: string | null) {
  const existing = await prisma.investorAccount.findUnique({ where: { fanId } });
  if (existing) return existing;

  const seq = await nextInvestorSeq();
  return prisma.investorAccount
    .create({
      data: { fanId, investorNumber: investorNumberFromSeq(seq), isDemo: true },
    })
    .then(async (created) => {
      await auditLog({
        actorType: "investor",
        actorId: fanId,
        action: "ACCOUNT_CREATED",
        entityType: "InvestorAccount",
        entityId: created.id,
        details: { investorNumber: created.investorNumber },
        ipAddress,
      }).catch(() => {});
      return created;
    });
}