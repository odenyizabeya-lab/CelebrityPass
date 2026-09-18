import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { getOrCreateInvestorAccount, getInvestorAccountByFan, toInvestorView } from "@/lib/invest/account";
import { investorBalances } from "@/lib/invest/ledger";
import { isDemoMode, investModeLabel } from "@/lib/invest/mode";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// GET /api/invest/account — summary: account, balances, mode, kyc, notifications.
export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const account = await getInvestorAccountByFan(fanId);
  if (!account) {
    return NextResponse.json({
      account: null,
      mode: await investModeLabel(),
      balances: { cash: "0.00", invested: "0.00", total: "0.00", currency: "USD" },
    });
  }

  const [balances, unreadNotifications, demo] = await Promise.all([
    investorBalances(account.id),
    prisma.investNotification.count({ where: { investorId: account.id, readAt: null } }),
    isDemoMode(),
  ]);

  return NextResponse.json({
    account: toInvestorView(account),
    mode: await investModeLabel(),
    isDemo: demo,
    balances: { cash: balances.cash.toFixed(2),
    invested: balances.invested.toFixed(2),
    total: balances.total.toFixed(2), currency: "USD" },
    unreadNotifications,
  });
}

// POST /api/invest/account — open account / save profile basics (never earns status).
export async function POST(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const country = String(body?.country ?? "").trim();
  const legalFullName = String(body?.legalFullName ?? "").trim();
  if (!country && !legalFullName) {
    return NextResponse.json({ error: "Provide at least one field to update." }, { status: 400 });
  }

  try {
    const account = await getOrCreateInvestorAccount(fanId);
    await prisma.investorAccount.update({
      where: { id: account.id },
      data: {
        ...(country ? { country: country.slice(0, 80) } : {}),
        ...(legalFullName ? { legalFullName: legalFullName.slice(0, 120) } : {}),
      },
    });
    return NextResponse.json({ ok: true, account: toInvestorView(await getInvestorAccountByFan(fanId) as never) }, { status: 200 });
  } catch (err) {
    return investErrorResponse(err);
  }
}