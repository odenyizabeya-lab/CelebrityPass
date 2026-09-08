import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/social/admin/articles/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const article = await prisma.socialArticle.findUnique({
    where: { id },
    include: { linkedCelebrity: { select: { id: true, name: true } } },
  });
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ article });
}

// PUT /api/social/admin/articles/[id] — update. Supports publish/unpublish state changes.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const existing = await prisma.socialArticle.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body?.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
    data.slug = slugify(body.title.trim()) || existing.slug;
  }
  if (typeof body?.summary === "string") data.summary = body.summary || null;
  if (typeof body?.body === "string") data.body = body.body || null;
  if (typeof body?.author === "string") data.author = body.author || null;
  if (typeof body?.category === "string") data.category = body.category || null;
  if (typeof body?.coverImage === "string") data.coverImage = body.coverImage || null;
  if (typeof body?.autoPostEnabled === "boolean") data.autoPostEnabled = body.autoPostEnabled;

  // Status transitions: publishing sets publishedAt, archiving keeps history.
  if (typeof body?.status === "string" && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(body.status)) {
    data.status = body.status;
    if (body.status === "PUBLISHED" && existing.status !== "PUBLISHED") data.publishedAt = new Date();
    if (body.status === "DRAFT") data.publishedAt = null;
  }
  if (body?.linkedCelebrityId !== undefined) data.linkedCelebrityId = body.linkedCelebrityId ? String(body.linkedCelebrityId) : null;

  await prisma.socialArticle.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE /api/social/admin/articles/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.socialArticle.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}