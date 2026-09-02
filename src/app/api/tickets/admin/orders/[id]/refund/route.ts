import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { requestRefund, recordRefund } from "@/lib/ticketing/service";

export const dynamic = "force-dynamic";

// POST /api/tickets/admin/orders/[id]/refund
// body: { action: "request" | "record", note?, reference? }
//  - "request": logs an unprocessed refund request (no money moved).
//  - "record":  records a refund that was REALLY processed at the ticket
//               source (real reference required).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "request");

  if (action === "record") {
    const result = await recordRefund(id, String(body?.reference ?? ""), body?.note ? String(body.note) : undefined);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  }
  const result = await requestRefund(id, body?.note ? String(body.note) : "");
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}