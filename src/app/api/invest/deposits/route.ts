import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentFanId } from "@/lib/auth";
import { createDepositIntent, DEPOSIT_METHODS, type DepositMethod } from "@/lib/invest/deposits";
import { listActiveBankAccounts } from "@/lib/ticketing/banking";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// GET /api/invest/deposits
//   The catalog of Bank Transfer destinations, straight from the admin-managed
//   bank accounts (the single source of truth). Returns only the countries and
//   currency codes that are ALREADY configured — never invented. No banking
//   identifiers are exposed here; the exact account details are returned on the
//   deposit intent once the customer has picked their country and currency.
export async function GET() {
  const accounts = await listActiveBankAccounts();
  const byCountry = new Map<string, { country: string; flag: string | null; currencies: string[] }>();
  for (const a of accounts) {
    let entry = byCountry.get(a.countryName);
    if (!entry) {
      entry = { country: a.countryName, flag: a.countryFlag, currencies: [] };
      byCountry.set(a.countryName, entry);
    }
    if (!entry.currencies.includes(a.currency)) entry.currencies.push(a.currency);
  }
  return NextResponse.json({ ok: true, bankTransfer: Array.from(byCountry.values()) });
}

// POST /api/invest/deposits
//   Opens a manual deposit intent for ONE channel — Bank Transfer or ATM
//   Deposit (never a merged flow): a PENDING ledger transaction + a
//   method-specific deposit reference + the instructions/destination for that
//   channel. Nothing is credited until the admin verifies the receipt image.
export async function POST(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const raw = String(body?.amount ?? "").trim();
  const amount = /^\d+(\.\d{1,2})?$/.test(raw) ? new Prisma.Decimal(raw) : null;
  if (!amount) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });

  const rawMethod = String(body?.method ?? "bank-transfer").trim();
  const method: DepositMethod = DEPOSIT_METHODS.includes(rawMethod as DepositMethod)
    ? (rawMethod as DepositMethod)
    : "bank-transfer";

  const currency = body?.currency ? String(body.currency).trim().toUpperCase().slice(0, 8) || null : null;
  const country = body?.country ? String(body.country).trim().slice(0, 120) || null : null;

  const opportunityId = body?.opportunityId ? String(body.opportunityId).trim().slice(0, 80) || null : null;

  try {
    const intent = await createDepositIntent({
      fanId,
      amount,
      method,
      currency,
      country,
      opportunityId,
      ipAddress: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({
      ok: true,
      mode: intent.mode,
      method: intent.method,
      pendingTxnId: intent.pendingTxnId,
      depositRef: intent.depositRef,
      amount: intent.amount,
      currency: intent.currency,
      bankAccount: intent.bankAccount,
      atmInstructions: intent.atmInstructions,
      opportunityId: intent.opportunityId,
      status: "PENDING_VERIFICATION",
    });
  } catch (err) {
    return investErrorResponse(err);
  }
}