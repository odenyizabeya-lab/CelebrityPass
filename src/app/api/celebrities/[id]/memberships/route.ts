import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/celebrities/[id]/memberships?includeInactive=true
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
  const memberships = await prisma.membershipLevel.findMany({
    where: { celebrityId: id, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { displayOrder: "asc" },
  });
  return NextResponse.json({ memberships });
}

// POST create membership level (admin)
export async function POST(request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !body.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const count = await prisma.membershipLevel.count({ where: { celebrityId: id } });
  const membership = await prisma.membershipLevel.create({
    data: {
      celebrityId: id,
      name: String(body.name),
      description: body.description ? String(body.description) : null,
      benefits: body.benefits ? String(body.benefits) : null,
      price: typeof body.price === "number" ? body.price : null,
      currency: String(body.currency ?? "USD"),
      displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : count,
      isActive: Boolean(body.isActive ?? true),
    },
  });
  return NextResponse.json({ membership }, { status: 201 });
}