import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { fetchGoogleInfo, type GoogleInfo } from "@/lib/google-info";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST — (re)fetch the Google-style knowledge panel for a celebrity and cache it.
// Admin-only. Returns the fresh panel so the admin UI can show a result.
export async function POST(_request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const celebrity = await prisma.celebrity.findUnique({
    where: { id },
    select: { id: true, name: true, profession: true, category: true },
  });
  if (!celebrity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const info = await fetchGoogleInfo(celebrity.name, {
    force: true,
    profession: celebrity.profession,
    category: celebrity.category,
  });
  if (!info) {
    return NextResponse.json(
      { error: `Could not find reliable info for "${celebrity.name}" on Wikipedia.`, info: null },
      { status: 404 }
    );
  }

  await prisma.celebrity.update({
    where: { id: celebrity.id },
    data: { googleInfo: JSON.stringify(info) },
  });

  return NextResponse.json({ info: info as GoogleInfo, ok: true });
}