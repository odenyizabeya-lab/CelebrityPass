import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { atmCardConfigStatus, ATM_CARD_PUBLIC_KEY_ENV, ATM_CARD_SECRET_KEY_ENV } from "@/lib/ticketing/universal";

export const dynamic = "force-dynamic";

// GET /api/tickets/admin/atm-card — status of the ATM Card processor connection.
// Reports booleans only — never the credential values themselves.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = atmCardConfigStatus();
  return NextResponse.json({
    publicKeyEnv: ATM_CARD_PUBLIC_KEY_ENV,
    secretKeyEnv: ATM_CARD_SECRET_KEY_ENV,
    ...status,
  });
}