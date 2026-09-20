import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { listPendingInvestDepositProofs, DEPOSIT_METHODS, type DepositMethod } from "@/lib/invest/deposits";

export const dynamic = "force-dynamic";

// GET /api/admin/invest/deposits?method=bank-transfer|atm-deposit
//   Investor deposit proofs newest-first for ONE channel only (defaults to all).
//   The Bank Transfer and ATM Deposit queues are always kept separate.
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawMethod = request.nextUrl.searchParams.get("method") ?? "";
  const method: DepositMethod | undefined = DEPOSIT_METHODS.includes(rawMethod as DepositMethod)
    ? (rawMethod as DepositMethod)
    : undefined;

  const proofs = await listPendingInvestDepositProofs(method);
  return NextResponse.json({ proofs, method: method ?? "all" });
}