import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reviewBankTransferProof } from "@/lib/ticketing/universal-proofs";

export const dynamic = "force-dynamic";

// GET /api/tickets/admin/bank-proofs/[id]
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const proof = await prisma.bankTransferProof.findUnique({
    where: { id },
    include: {
      bankAccount: true,
      payment: { include: { celebrity: { select: { name: true } }, membershipLevel: { select: { name: true } }, fan: { select: { name: true, email: true } } } },
      ticketOrder: { include: { event: { select: { name: true } }, items: true } },
    },
  });
  if (!proof) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payment = proof.payment
    ? {
        type: "fan card",
        description: proof.payment.description,
        fanName: proof.payment.fan?.name ?? null,
        fanEmail: proof.payment.fan?.email ?? null,
        celebrity: proof.payment.celebrity?.name ?? null,
        membership: proof.payment.membershipLevel?.name ?? null,
      }
    : null;
  const ticketOrder = proof.ticketOrder
    ? {
        orderRef: proof.ticketOrder.orderRef,
        event: proof.ticketOrder.event.name,
        items: proof.ticketOrder.items.map((i) => ({
          name: i.ticketName,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
        })),
      }
    : null;

  return NextResponse.json({
    proof: {
      id: proof.id,
      status: proof.status,
      adminNote: proof.adminNote,
      amountCents: proof.amountCents,
      currency: proof.currency,
      senderName: proof.senderName,
      reference: proof.reference,
      transferDate: proof.transferDate ? proof.transferDate.toISOString() : null,
      fileName: proof.fileName,
      fileUrl: proof.fileUrl,
      mimeType: proof.mimeType,
      createdAt: proof.createdAt.toISOString(),
      reviewedAt: proof.reviewedAt ? proof.reviewedAt.toISOString() : null,
      bankAccount: proof.bankAccount
        ? {
            currency: proof.bankAccount.currency,
            countryName: proof.bankAccount.countryName,
            beneficiary: proof.bankAccount.beneficiary,
            bankName: proof.bankAccount.bankName,
          }
        : null,
    },
    payment,
    ticketOrder,
  });
}

// POST /api/tickets/admin/bank-proofs/[id] — approve or reject (the admin's real review).
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const decision = body?.decision === "REJECT" ? "REJECT" : "APPROVE";
  const adminNote = body?.adminNote ? String(body.adminNote) : null;
  const origin = request.headers.get("origin");

  const result = await reviewBankTransferProof({ proofId: id, decision, adminNote, origin });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true, status: result.status, settledKind: result.settledKind });
}