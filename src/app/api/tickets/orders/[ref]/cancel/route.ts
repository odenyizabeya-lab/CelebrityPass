import { NextResponse, type NextRequest } from "next/server";
import { cancelOrderForHolder } from "@/lib/ticketing/service";

export const dynamic = "force-dynamic";

// POST /api/tickets/orders/[ref]/cancel — cancel an unpaid order.
export async function POST(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const token = (request.nextUrl.searchParams.get("t") ?? request.headers.get("x-order-token")) as string | null;
  const result = await cancelOrderForHolder(ref, token);
  const status = result.status ?? (result.ok ? 200 : 409);
  return NextResponse.json(result, { status });
}