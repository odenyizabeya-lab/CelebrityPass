import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed, getCurrentFanId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/payments?status=&q=  (admin)
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") ?? undefined;
  const q = sp.get("q")?.trim().toLowerCase();

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const payments = await prisma.payment.findMany({
    where,
    include: {
      fan: { select: { name: true, email: true } },
      card: { select: { fanNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const visible = q
    ? payments.filter((p) =>
        [p.fan.name, p.fan.email, p.description, p.id, p.gatewayRef, p.card?.fanNumber]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q)),
      )
    : payments;

  return NextResponse.json({
    payments: visible.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      provider: p.provider,
      gatewayRef: p.gatewayRef,
      description: p.description,
      createdAt: p.createdAt,
      paidAt: p.paidAt,
      fanName: p.fan.name,
      fanEmail: p.fan.email,
      fanNumber: p.card?.fanNumber ?? null,
    })),
  });
}

// POST /api/payments  (logged-in fan) — create/pay-later a membership payment.
export async function POST(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const levelId = String(body?.membershipLevelId ?? "");
  if (!levelId) return NextResponse.json({ error: "membershipLevelId is required" }, { status: 400 });

  const level = await prisma.membershipLevel.findUnique({
    where: { id: levelId },
    include: { celebrity: { select: { id: true, slug: true, name: true, isActive: true } } },
  });
  if (!level || !level.isActive || !level.celebrity?.isActive) {
    return NextResponse.json({ error: "Membership level not available" }, { status: 404 });
  }
  if (level.price == null || level.price <= 0) {
    return NextResponse.json({ error: "This level is free — no payment needed" }, { status: 400 });
  }

  const existingCard = await prisma.fanCard.findFirst({
    where: { fanId, celebrityId: level.celebrityId },
  });
  if (existingCard) {
    return NextResponse.json({ error: "You already hold a card in this community" }, { status: 409 });
  }

  // Resume an unfinished payment for this community instead of stacking new ones.
  const open = await prisma.payment.findFirst({
    where: { fanId, celebrityId: level.celebrityId, status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (open) return NextResponse.json({ payment: { id: open.id, status: open.status } });

  const payment = await prisma.payment.create({
    data: {
      fanId,
      celebrityId: level.celebrityId,
      membershipLevelId: level.id,
      amount: level.price,
      currency: level.currency || "USD",
      status: "PENDING",
      provider: "mock",
      description: `${level.celebrity.name} — ${level.name}`,
    },
  });

  return NextResponse.json({ payment: { id: payment.id, status: payment.status } }, { status: 201 });
}