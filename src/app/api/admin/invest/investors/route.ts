import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { listAdminInvestors } from "@/lib/invest/kyc";

export const dynamic = "force-dynamic";

// GET /api/admin/invest/investors — all investors with KYC state (q filter).
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  const rows = await listAdminInvestors();
  const visible = q
    ? rows.filter((r) => [r.email, r.investorNumber, r.legalFullName, r.kycLegalName].filter(Boolean).some((f) => String(f).toLowerCase().includes(q)))
    : rows;
  return NextResponse.json({ investors: visible });
}