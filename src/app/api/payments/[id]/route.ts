import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId, isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/payments/[id] — order summary for the checkout page.
// Visible to the paying fan (via session) or an admin.
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const [payment, fanId, admin] = await Promise.all([
    prisma.payment.findUnique({
      where: { id },
      include: {
        celebrity: { select: { name: true, slug: true, accentColor: true, profileImage: true } },
        membershipLevel: { select: { name: true } },
        card: { select: { fanNumber: true, status: true, cardUrl: true } },
      },
    }),
    getCurrentFanId(),
    isAdminAuthed(),
  ]);
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (!admin && payment.fanId !== fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    payment: {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      description: payment.description,
      provider: payment.provider,
      createdAt: payment.createdAt,
    },
    celebrity: payment.celebrity,
    level: payment.membershipLevel ? { name: payment.membershipLevel.name } : null,
    card: payment.card,
  });
}

// PATCH /api/payments/[id] — admin actions (REFUND).
export async function PATCH(request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "").toUpperCase();

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  if (action === "REFUND") {
    if (payment.status !== "PAID") {
      return NextResponse.json({ error: "Only paid payments can be refunded" }, { status: 400 });
    }
    const updated = await prisma.payment.update({
      where: { id },
      data: { status: "REFUNDED" },
    });
    return NextResponse.json({ payment: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}