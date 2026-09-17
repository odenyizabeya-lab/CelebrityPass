// GET /api/admin/celebrities/search?q= — lightweight celebrity search for the
// admin "Find anyone to edit" quick search. Gated to admins. Intentionally
// tiny rows (no base64 image columns) so the typeahead stays instant even with
// a huge database.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { celebrityImageFlags } from "@/lib/images";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
          { country: { contains: q, mode: "insensitive" as const } },
          { profession: { contains: q, mode: "insensitive" as const } },
          { category: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, flags] = await Promise.all([
    prisma.celebrity.findMany({
      where,
      orderBy: { name: "asc" },
      take: q ? 20 : 8,
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        country: true,
        profession: true,
        accentColor: true,
        isVerified: true,
        isFeatured: true,
        isActive: true,
      },
    }),
    celebrityImageFlags(),
  ]);

  return NextResponse.json({
    celebrities: rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      category: c.category,
      country: c.country,
      profession: c.profession,
      accentColor: c.accentColor,
      isVerified: c.isVerified,
      isFeatured: c.isFeatured,
      isActive: c.isActive,
      hasProfile: Boolean(flags.get(c.slug)?.hasProfile),
    })),
  });
}