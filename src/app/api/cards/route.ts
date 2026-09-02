import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { cardUrlFor, fanNumberFromSeq, nextFanSeq } from "@/lib/utils";
import { qrSvgDataUri } from "@/lib/qr";
import { isAdminAuthed } from "@/lib/auth";
import { listAdminCards } from "@/lib/services";

export const dynamic = "force-dynamic";

// GET /api/cards?search=&celebrityId=&status=
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const cards = await listAdminCards({
    search: sp.get("search") ?? undefined,
    celebrityId: sp.get("celebrityId") ?? undefined,
    status: sp.get("status") ?? undefined,
  });
  return NextResponse.json({ cards });
}

// POST /api/cards  (admin) — issue a new card for an existing fan + celebrity.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body?.fanId || !body?.celebrityId) {
    return NextResponse.json({ error: "fanId and celebrityId are required" }, { status: 400 });
  }

  const [fan, celebrity] = await Promise.all([
    prisma.fan.findUnique({ where: { id: String(body.fanId) } }),
    prisma.celebrity.findUnique({ where: { id: String(body.celebrityId) } }),
  ]);
  if (!fan || !celebrity) {
    return NextResponse.json({ error: "Fan or celebrity not found" }, { status: 404 });
  }

  const duplicate = await prisma.fanCard.findFirst({
    where: { fanId: fan.id, celebrityId: celebrity.id },
  });
  if (duplicate) {
    return NextResponse.json({ error: "This fan already has a card in this community" }, { status: 409 });
  }

  let membershipLevelId: string | null = null;
  if (body.membershipLevelId) {
    const level = await prisma.membershipLevel.findFirst({
      where: { id: String(body.membershipLevelId), celebrityId: celebrity.id },
    });
    if (level) membershipLevelId = level.id;
  }

  const seq = await nextFanSeq();
  const fanNumber = fanNumberFromSeq(seq);
  const cardUrl = cardUrlFor(celebrity.slug, fanNumber);
  const origin =
    request.headers.get("origin") ??
    request.headers.get("x-forwarded-proto") + "://" + (request.headers.get("x-forwarded-host") ?? "localhost:3000");
  const qrCode = await qrSvgDataUri(`${origin}${cardUrl}`);

  const card = await prisma.fanCard.create({
    data: {
      fanId: fan.id,
      celebrityId: celebrity.id,
      membershipLevelId,
      fanNumber,
      cardUrl,
      qrCode,
      status: String(body.status ?? "ACTIVE"),
    },
    include: { celebrity: true, fan: true, membershipLevel: true },
  });

  return NextResponse.json({ card }, { status: 201 });
}