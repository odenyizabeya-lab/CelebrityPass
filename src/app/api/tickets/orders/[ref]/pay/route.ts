import { NextResponse, type NextRequest } from "next/server";
import { attemptOrderPayment } from "@/lib/ticketing/service";

export const dynamic = "force-dynamic";

// POST /api/tickets/orders/[ref]/pay — attempts real payment.
// With no gateway connected this honestly blocks; it never fabricates success.
export async function POST(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const token = (request.nextUrl.searchParams.get("t") ?? request.headers.get("x-order-token")) as string | null;
  const body = await request.json().catch(() => null);

  const result = await attemptOrderPayment(ref, token, body?.paymentMethodId ? String(body.paymentMethodId) : null);
  const status = result.status ?? 400;
  return NextResponse.json({ ok: result.ok, event: result.event, message: result.message, order: result.order ?? undefined }, { status });
}