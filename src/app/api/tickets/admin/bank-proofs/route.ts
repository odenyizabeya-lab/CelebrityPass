import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { listPendingBankTransferProofs } from "@/lib/ticketing/universal-proofs";

export const dynamic = "force-dynamic";

// GET /api/tickets/admin/bank-proofs — the pending verification queue.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const proofs = await listPendingBankTransferProofs();
  return NextResponse.json({ proofs });
}