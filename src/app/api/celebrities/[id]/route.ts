import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { isAdminAuthed } from "@/lib/auth";
import { getCelebrityBySlug } from "@/lib/services";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const bySlug = await getCelebrityBySlug(id);
  if (bySlug) return NextResponse.json({ celebrity: bySlug });

  const byId = await prisma.celebrity.findUnique({ where: { id } });
  return NextResponse.json({ celebrity: byId }, byId ? { status: 200 } : { status: 404 });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const celebrity = await prisma.celebrity.findUnique({ where: { id } });
  if (!celebrity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
    data.slug = String(body.slug ?? "").trim() ? slugify(String(body.slug)) : celebrity.slug;
  }
  const stringFields = [
    "category",
    "country",
    "city",
    "profession",
    "bio",
    "shortBio",
    "profileImage",
    "coverImage",
    "accentColor",
    "website",
  ] as const;
  for (const field of stringFields) {
    if (body[field] !== undefined) data[field] = body[field] === null ? null : String(body[field]);
  }
  if (body.socialLinks !== undefined) data.socialLinks = JSON.stringify(body.socialLinks);
  if (body.cardDesign !== undefined) data.cardDesign = JSON.stringify(body.cardDesign);
  if (body.isFeatured !== undefined) data.isFeatured = Boolean(body.isFeatured);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const followerFields = ["instagramFollowers", "tiktokFollowers", "facebookFollowers"] as const;
  const anyFollower = followerFields.some((f) => body[f] !== undefined && body[f] !== null && body[f] !== "");
  for (const field of followerFields) {
    if (body[field] === null || body[field] === "") data[field] = null;
    else if (body[field] !== undefined) data[field] = Number(body[field]);
  }
  if (anyFollower) data.followersUpdatedAt = new Date();

  const updated = await prisma.celebrity.update({ where: { id }, data });
  return NextResponse.json({ celebrity: updated });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.celebrity.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.celebrity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}