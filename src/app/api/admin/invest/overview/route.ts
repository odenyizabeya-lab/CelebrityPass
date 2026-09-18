import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { isDemoMode, investModeLabel } from "@/lib/invest/mode";

export const dynamic = "force-dynamic";

// GET /api/admin/invest/overview — investor platform aggregates + mode.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [investors, pendingKyc, pendingWithdrawals, openOpportunities, positions, alerts, demo] = await Promise.all([
    prisma.investorAccount.count(),
    prisma.kycRecord.count({ where: { status: "PENDING" } }),
    prisma.withdrawal.count({ where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "PROCESSING"] } } }),
    prisma.investmentOpportunity.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
    prisma.investmentPosition.count({ where: { status: "ACTIVE" } }),
    prisma.complianceAlert.count({ where: { status: { in: ["OPEN", "REVIEWED"] } } }),
    isDemoMode(),
  ]);

  const ledgers = await prisma.ledgerEntry.findMany({
    where: { account: { startsWith: "investor:" } },
    select: { account: true, amount: true },
  });
  let cash = 0;
  let invested = 0;
  for (const row of ledgers) {
    const n = Number(row.amount);
    if (/^investor:[^:]+:cash$/.test(row.account)) cash += n;
    else if (row.account.includes(":position:")) invested += n;
  }

  return NextResponse.json({
    mode: await investModeLabel(),
    isDemo: demo,
    counts: { investors, pendingKyc, pendingWithdrawals, openOpportunities, activePositions: positions, openAlerts: alerts },
    aum: { cash: cash.toFixed(2), invested: invested.toFixed(2), total: (cash + invested).toFixed(2), currency: "USD" },
  });
}