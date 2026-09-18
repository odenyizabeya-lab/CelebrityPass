import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed, getCurrentAdminEmail } from "@/lib/auth";
import { decideKyc } from "@/lib/invest/kyc";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// POST /api/admin/invest/kyc/[investorId] — record an admin KYC decision.
export async function POST(request: NextRequest, context: { params: Promise<{ investorId: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const adminEmail = (await getCurrentAdminEmail()) ?? "admin@sistemapocket.dev";
  const { investorId } = await context.params;

  const body = await request.json().catch(() => null);
  const decision = String(body?.decision ?? "").toUpperCase();
  if (!["VERIFIED", "REJECTED", "ADDITIONAL_INFORMATION_REQUIRED"].includes(decision)) {
    return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
  }

  try {
    const result = await decideKyc({
      investorId,
      decision: decision as "VERIFIED" | "REJECTED" | "ADDITIONAL_INFORMATION_REQUIRED",
      adminEmail,
      note: body?.note ? String(body.note).trim() : null,
    });
    return NextResponse.json({ ok: true, kycStatus: result.kycStatus });
  } catch (err) {
    return investErrorResponse(err);
  }
}