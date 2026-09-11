import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const celebrities = await prisma.celebrity.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      profession: true,
      profileImage: true,
      accentColor: true,
      isVerified: true,
    },
  });
  const selections = await prisma.fanCelebritySelection.findMany({
    where: { fanId },
    select: { celebrityId: true },
  });
  const selected = new Set(selections.map((s) => s.celebrityId));
  return NextResponse.json({
    celebrities: celebrities.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      profession: c.profession,
      profileImage: c.profileImage,
      accentColor: c.accentColor,
      isVerified: c.isVerified,
      selected: selected.has(c.id),
    })),
  });
}

export async function POST(request: Request) {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const bodyIds: unknown = Array.isArray(body?.celebrityIds) ? body.celebrityIds : [];
  const ids: string[] = [...new Set((bodyIds as unknown[]).map((x) => String(x)).filter((id) => id.length > 0))];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Choose at least one celebrity" }, { status: 400 });
  }
  if (ids.length > 30) {
    return NextResponse.json({ error: "Choose at most 30 celebrities" }, { status: 400 });
  }

  const found = await prisma.celebrity.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    return NextResponse.json({ error: "One or more celebrities are unavailable" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.fanCelebritySelection.deleteMany({ where: { fanId } }),
    prisma.fanCelebritySelection.createMany({
      data: ids.map((celebrityId) => ({ fanId, celebrityId })),
    }),
  ]);

  return NextResponse.json({ ok: true, count: ids.length });
}