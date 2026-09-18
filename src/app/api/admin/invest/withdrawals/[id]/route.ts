import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed, getCurrentAdminEmail } from "@/lib/auth";
import { reviewWithdrawal, completeWithdrawal } from "@/lib/invest/withdrawals";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// PATCH /api/admin/invest/withdrawals/[id]
//   { action: "APPROVE" | "REJECT" | "COMPLETE", note?, gatewayRef? }
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const adminEmail = (await getCurrentAdminEmail()) ?? "admin@sistemapocket.dev";
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "").toUpperCase();
  const note = body?.note ? String(body.note).trim() : null;

  try {
    if (action === "APPROVE" || action === "REJECT") {
      const result = await reviewWithdrawal({
        withdrawalId: id,
        decision: action as "APPROVE" | "REJECT",
        adminEmail,
        note,
      });
      return NextResponse.json(result);
    }
    if (action === "COMPLETE") {
      const result = await completeWithdrawal({ withdrawalId: id, adminEmail, gatewayRef: body?.gatewayRef ? String(body.gatewayRef) : null });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err) {
    return investErrorResponse(err);
  }
}