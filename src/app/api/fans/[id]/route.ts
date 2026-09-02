import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/utils";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const fan = await prisma.fan.findUnique({
    where: { id },
    include: {
      cards: {
        include: { celebrity: { select: { name: true, slug: true } }, membershipLevel: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!fan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ fan });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const fan = await prisma.fan.findUnique({ where: { id } });
  if (!fan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    const dup = await prisma.fan.findFirst({ where: { email, id: { not: id } } });
    if (dup) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    data.email = email;
  }
  if (body.phone !== undefined) data.phone = body.phone === null ? null : String(body.phone);
  if (body.country !== undefined) data.country = body.country === null ? null : String(body.country);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.password) data.password = hashPassword(String(body.password));

  const updated = await prisma.fan.update({ where: { id }, data });
  return NextResponse.json({ fan: updated });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const fan = await prisma.fan.findUnique({ where: { id } });
  if (!fan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.fan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}