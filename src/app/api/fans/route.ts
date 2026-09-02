import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/utils";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/fans?search=&celebrityId=&isActive=
// Admin only.
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const search = sp.get("search")?.trim();
  const celebrityId = sp.get("celebrityId");
  const isActive = sp.get("isActive");

  const where: Record<string, unknown> = {};
  if (celebrityId) where.cards = { some: { celebrityId } };
  if (isActive === "true") where.isActive = true;
  if (isActive === "false") where.isActive = false;

  const fans = await prisma.fan.findMany({
    where,
    include: { _count: { select: { cards: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const q = search?.toLowerCase();
  const visible = q
    ? fans.filter((f) =>
        [f.name, f.email, f.country].filter(Boolean).some((field) => String(field).toLowerCase().includes(q)),
      )
    : fans;

  return NextResponse.json({
    fans: visible.map((f) => ({
      id: f.id,
      name: f.name,
      email: f.email,
      phone: f.phone,
      country: f.country,
      isActive: f.isActive,
      createdAt: f.createdAt,
      cardCount: f._count.cards,
    })),
  });
}

// POST /api/fans  (admin) — create a fan account.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!name || !email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "A valid name and email are required" }, { status: 400 });
  }
  const existing = await prisma.fan.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A fan with this email already exists" }, { status: 409 });
  }
  const fan = await prisma.fan.create({
    data: {
      name,
      email,
      country: body.country ? String(body.country) : null,
      phone: body.phone ? String(body.phone) : null,
      password: body.password ? hashPassword(String(body.password)) : null,
    },
  });
  return NextResponse.json({ fan }, { status: 201 });
}