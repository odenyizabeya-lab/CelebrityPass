import { NextResponse, type NextRequest } from "next/server";
import { submitBankTransferProof } from "@/lib/ticketing/universal-proofs";

export const dynamic = "force-dynamic";

// POST /api/tickets/orders/[ref]/bank-transfer — submit a proof for a ticket order.
export async function POST(request: NextRequest, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Malformed body." }, { status: 400 });

  const token = request.headers.get("x-order-token") ?? request.nextUrl.searchParams.get("t");

  const result = await submitBankTransferProof({
    kind: "TICKET",
    ticketOrderRef: ref,
    token,
    proof: {
      senderName: body.senderName ?? null,
      reference: body.reference ?? null,
      transferDate: body.transferDate ?? null,
      amountCents: Number(body.amountCents),
      currency: body.currency ?? "USD",
      fileName: body.fileName ?? null,
      fileUrl: body.fileUrl ?? null,
      mimeType: body.mimeType ?? null,
    },
  });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ proof: result.proof, status: result.status }, { status: 201 });
}