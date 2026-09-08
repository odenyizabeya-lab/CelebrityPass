import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/social/admin/articles — all marketplace news/articles.
export async function GET(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const rows = await prisma.socialArticle.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    include: { linkedCelebrity: { select: { name: true } } },
  });
  return NextResponse.json({
    articles: rows.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      author: a.author,
      category: a.category,
      coverImage: a.coverImage,
      status: a.status,
      autoPostEnabled: a.autoPostEnabled,
      linkedCelebrity: a.linkedCelebrity?.name ?? null,
      publishedAt: a.publishedAt,
      createdAt: a.createdAt,
    })),
  });
}

// POST /api/social/admin/articles — create an article (DRAFT by default).
export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const baseSlug = slugify(title) || "article";
  let slug = baseSlug;
  let n = 2;
  while (await prisma.socialArticle.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${n++}`;
  }

  const status = String(body?.status ?? "DRAFT");
  const article = await prisma.socialArticle.create({
    data: {
      slug,
      title,
      summary: body?.summary ? String(body.summary) : null,
      body: body?.body ? String(body.body) : null,
      author: body?.author ? String(body.author) : null,
      category: body?.category ? String(body.category) : "News",
      coverImage: body?.coverImage ? String(body.coverImage) : null,
      status: ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status) ? status : "DRAFT",
      autoPostEnabled: typeof body?.autoPostEnabled === "boolean" ? body.autoPostEnabled : true,
      linkedCelebrityId: body?.linkedCelebrityId ? String(body.linkedCelebrityId) : null,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });
  return NextResponse.json({ ok: true, id: article.id, slug: article.slug });
}