import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { clearReadCache } from "@/lib/services";
import { revalidateCelebrityPages } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const level = await prisma.membershipLevel.findUnique({ where: { id } });
  if (!level) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  for (const field of ["name", "description", "benefits", "currency"] as const) {
    if (body[field] !== undefined) data[field] = body[field] === null ? null : String(body[field]);
  }
  if (body.price !== undefined) data.price = body.price === null || body.price === "" ? null : Number(body.price);
  if (body.displayOrder !== undefined) data.displayOrder = Number(body.displayOrder);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const [updated, celebrity] = await Promise.all([
    prisma.membershipLevel.update({ where: { id }, data }),
    prisma.celebrity.findUnique({ where: { id: level.celebrityId }, select: { slug: true } }),
  ]);
  if (celebrity) {
    clearReadCache();
    revalidateCelebrityPages(celebrity.slug);
  }
  return NextResponse.json({ membership: updated });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const level = await prisma.membershipLevel.findUnique({ where: { id } });
  if (!level) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const celebrity = await prisma.celebrity.findUnique({ where: { id: level.celebrityId }, select: { slug: true } });
  await prisma.membershipLevel.delete({ where: { id } });
  if (celebrity) {
    clearReadCache();
    revalidateCelebrityPages(celebrity.slug);
  }
  return NextResponse.json({ ok: true });
}