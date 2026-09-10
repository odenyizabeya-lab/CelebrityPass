// POST /api/admin/payment-settings/test — test Flutterwave credentials.
//   body: { clientId?: string, clientSecret?: string, environment?: "test" | "live" }
// Uses the provided values, or the saved/environment values when omitted. The
// key is sent to Flutterwave only in the Authorization header and is never
// echoed back, logged, or included in any message.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { testFlutterwaveConnection } from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const clientId = body?.clientId && typeof body.clientId === "string" ? String(body.clientId).trim() : "";
  const clientSecret = body?.clientSecret && typeof body.clientSecret === "string" ? String(body.clientSecret).trim() : "";
  const environment = body?.environment === "test" || body?.environment === "live" ? body.environment : "";

  const result = await testFlutterwaveConnection({ clientId, clientSecret, environment });

  return NextResponse.json({ ok: result.ok, code: result.code, message: result.message, mode: result.mode });
}