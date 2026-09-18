import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getInvestDepositProof, approveInvestDeposit, rejectInvestDeposit } from "@/lib/invest/deposits";

export const dynamic = "force-dynamic";

// GET /api/admin/invest/deposits/[proofId] — a single deposit proof detail.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ proofId: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { proofId } = await ctx.params;
  const proof = await getInvestDepositProof(proofId);
  if (!proof) return NextResponse.json({ error: "Deposit proof not found." }, { status: 404 });
  return NextResponse.json({ proof });
}

// POST /api/admin/invest/deposits/[proofId] — approve or reject a deposit
// receipt (the admin's real review). Approval is the ONLY path that credits.
export async function POST(request: NextRequest, ctx: { params: Promise<{ proofId: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { proofId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const decision = body?.decision === "REJECT" ? "REJECT" : "APPROVE";
  const adminNote = body?.adminNote ? String(body.adminNote) : null;

  const result =
    decision === "REJECT"
      ? await rejectInvestDeposit({ proofId, adminNote })
      : await approveInvestDeposit({ proofId, adminNote });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true, status: result.status, credited: result.credited, subscribed: result.subscribed });
}