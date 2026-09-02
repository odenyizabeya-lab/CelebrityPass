import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { listSettlementRecords, addSettlementRecord } from "@/lib/ticketing/service";

export const dynamic = "force-dynamic";

// GET /api/tickets/admin/settlement — settlement bookkeeping records.
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const paymentMethodId = request.nextUrl.searchParams.get("paymentMethodId") ?? undefined;
  const records = await listSettlementRecords(paymentMethodId);
  return NextResponse.json({ records });
}

// POST /api/tickets/admin/settlement — record a REAL settlement from a real
// statement (amount + reference entered by the admin, never fabricated).
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.paymentMethodId || body?.amountCents === undefined) {
    return NextResponse.json({ error: "paymentMethodId and amountCents are required" }, { status: 400 });
  }
  try {
    const record = await addSettlementRecord({
      paymentMethodId: String(body.paymentMethodId),
      amountCents: Number(body.amountCents),
      currency: body.currency ? String(body.currency) : undefined,
      periodStart: body.periodStart ? String(body.periodStart) : null,
      periodEnd: body.periodEnd ? String(body.periodEnd) : null,
      reference: body.reference ? String(body.reference) : null,
      note: body.note ? String(body.note) : null,
    });
    return NextResponse.json({ record }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not add record" }, { status: 400 });
  }
}