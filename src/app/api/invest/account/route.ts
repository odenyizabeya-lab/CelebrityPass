import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { getOrCreateInvestorAccount, getInvestorAccountByFan, toInvestorView } from "@/lib/invest/account";
import { investorBalances } from "@/lib/invest/ledger";
import { getPositions, syncBrokerAccount, quantityToNumber } from "@/lib/invest/brokerage";
import { getQuote } from "@/lib/invest/market-data";
import { safeAsync } from "@/lib/safe-data";
import { isDemoMode, investModeLabel } from "@/lib/invest/mode";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

/** Real positions every personalized screen prices against live quotes. */
async function portfolioSummary(fanId: string) {
  const positions = await safeAsync(() => getPositions(fanId), []);
  let value = 0;
  let change = 0;
  let hasDemo = false;
  if (positions.length > 0) {
    const priced = await Promise.all(
      positions.map(async (p) => {
        const q = await getQuote(p.symbol);
        const qty = quantityToNumber(p.quantityCents);
        const price = q.price ?? Number(p.avgCostCents) / 100;
        const chg = q.change ?? 0;
        return { value: qty * price, change: qty * chg, isDemo: p.isDemo };
      }),
    );
    value = priced.reduce((s, p) => s + p.value, 0);
    change = priced.reduce((s, p) => s + p.change, 0);
    hasDemo = priced.some((p) => p.isDemo);
  }
  return {
    value: Math.round(value * 100) / 100,
    change: Math.round(change * 100) / 100,
    changeUp: change >= 0,
    hasDemo,
    positionCount: positions.length,
  };
}

// GET /api/invest/account — summary: account, balances, mode, kyc, notifications.
export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const [accountSource, broker, portfolio] = await Promise.all([
    getInvestorAccountByFan(fanId),
    safeAsync(() => syncBrokerAccount(fanId), null),
    portfolioSummary(fanId),
  ]);

  if (!accountSource) {
    return NextResponse.json({
      account: null,
      mode: await investModeLabel(),
      balances: { cash: "0.00", invested: "0.00", total: "0.00", currency: "USD" },
      brokerStatus: broker?.status ?? null,
      portfolio,
    });
  }

  const account = accountSource;
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
    brokerStatus: broker?.status ?? null,
    portfolio,
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