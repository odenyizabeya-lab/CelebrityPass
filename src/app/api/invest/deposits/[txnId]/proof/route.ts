import { NextResponse, type NextRequest } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { submitInvestDepositProof, DEPOSIT_METHODS, type DepositMethod } from "@/lib/invest/deposits";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// POST /api/invest/deposits/[txnId]/proof
//   Attach the customer's Bank Transfer or ATM receipt (image upload) to the
//   pending deposit — locked to the deposit's own method. Stays
//   PENDING_VERIFICATION until the admin approves.
export async function POST(request: NextRequest, ctx: { params: Promise<{ txnId: string }> }) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const { txnId } = await ctx.params;
  if (!txnId) return NextResponse.json({ error: "Missing deposit reference." }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid receipt data." }, { status: 400 });

  const amountCents = Number(body.amountCents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "Enter a valid transfer amount." }, { status: 400 });
  }

  const rawMethod = String(body.method ?? "").trim();
  const method: DepositMethod | undefined = DEPOSIT_METHODS.includes(rawMethod as DepositMethod)
    ? (rawMethod as DepositMethod)
    : undefined;

  try {
    const result = await submitInvestDepositProof({
      fanId,
      txnId,
      method,
      senderName: body.senderName ? String(body.senderName) : null,
      reference: body.reference ? String(body.reference) : null,
      transferDate: body.transferDate ? String(body.transferDate) : null,
      amountCents,
      currency: body.currency ? String(body.currency) : "USD",
      bankAccountId: body.bankAccountId ? String(body.bankAccountId) : null,
      fileName: body.fileName ? String(body.fileName) : null,
      fileUrl: body.fileUrl ? String(body.fileUrl) : null,
      mimeType: body.mimeType ? String(body.mimeType) : null,
      opportunityId: body.opportunityId ? String(body.opportunityId) : null,
      ipAddress: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return investErrorResponse(err);
  }
}