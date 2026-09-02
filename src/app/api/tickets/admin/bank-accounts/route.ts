import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { listAllBankAccounts, upsertBankAccount } from "@/lib/ticketing/banking";

export const dynamic = "force-dynamic";

// GET /api/tickets/admin/bank-accounts
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accounts = await listAllBankAccounts();
  return NextResponse.json({ accounts });
}

// POST /api/tickets/admin/bank-accounts — create or replace the account for a currency.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Malformed body" }, { status: 400 });

  try {
    const account = await upsertBankAccount({
      currency: String(body.currency ?? ""),
      countryName: String(body.countryName ?? ""),
      countryFlag: body.countryFlag ? String(body.countryFlag) : null,
      beneficiary: String(body.beneficiary ?? ""),
      bankName: String(body.bankName ?? ""),
      accountType: body.accountType ? String(body.accountType) : null,
      accountNumber: body.accountNumber ? String(body.accountNumber) : null,
      iban: body.iban ? String(body.iban) : null,
      bic: body.bic ? String(body.bic) : null,
      swift: body.swift ? String(body.swift) : null,
      routing: body.routing ? String(body.routing) : null,
      sortCode: body.sortCode ? String(body.sortCode) : null,
      institutionNumber: body.institutionNumber ? String(body.institutionNumber) : null,
      transitNumber: body.transitNumber ? String(body.transitNumber) : null,
      branchCode: body.branchCode ? String(body.branchCode) : null,
      bankCode: body.bankCode ? String(body.bankCode) : null,
      transferType: body.transferType ? String(body.transferType) : undefined,
      bankAddress: body.bankAddress ? String(body.bankAddress) : null,
      isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
      displayOrder: body.displayOrder === undefined ? undefined : Number(body.displayOrder),
      envKeyRef: body.envKeyRef ? String(body.envKeyRef) : null,
      notes: body.notes ? String(body.notes) : null,
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to save bank account" }, { status: 400 });
  }
}