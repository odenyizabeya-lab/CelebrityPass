import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE /api/tickets/admin/bank-accounts/[id]
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const account = await prisma.bankAccount.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Do NOT delete if it still has proofs referencing it.
  const proofs = await prisma.bankTransferProof.count({ where: { bankAccountId: id } });
  if (proofs > 0) {
    // Soft-remove: deactivate so history stays intact.
    await prisma.bankAccount.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true, archived: true, message: "Account deactivated (it still has payment history)." });
  }

  await prisma.bankAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true, archived: false });
}

// PATCH /api/tickets/admin/bank-accounts/[id] — toggle active, or partial edit.
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Malformed body" }, { status: 400 });

  const account = await prisma.bankAccount.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.displayOrder !== undefined) data.displayOrder = Number(body.displayOrder);

  const updated = await prisma.bankAccount.update({ where: { id }, data });
  return NextResponse.json({ account: updated });
}