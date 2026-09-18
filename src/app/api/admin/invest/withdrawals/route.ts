import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/invest/withdrawals?status= — withdrawals for admin review.
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = request.nextUrl.searchParams.get("status");
  const rows = await prisma.withdrawal.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: { investor: { select: { investorNumber: true, fan: { select: { email: true, name: true } } } } },
    take: 200,
  });
  return NextResponse.json({
    withdrawals: rows.map((w) => ({
      id: w.id,
      ref: w.ref,
      amount: w.amount.toString(),
      status: w.status,
      destinationJson: w.destinationJson,
      reviewNote: w.reviewNote,
      approvedById: w.approvedById,
      approvedAt: w.approvedAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
      investor: { number: w.investor.investorNumber, email: w.investor.fan.email, name: w.investor.fan.name },
    })),
  });
}