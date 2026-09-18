import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { listPendingInvestDepositProofs } from "@/lib/invest/deposits";

export const dynamic = "force-dynamic";

// GET /api/admin/invest/deposits — all investor deposit proofs (pending +
// decided), newest first, for the admin verification queue.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const proofs = await listPendingInvestDepositProofs();
  return NextResponse.json({ proofs });
}