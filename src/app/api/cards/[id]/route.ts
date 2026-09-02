import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Public GET for card previews (no fan email exposed unless admin asks).
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const admin = request.nextUrl.searchParams.get("admin") === "true" && (await isAdminAuthed());

  const card = await prisma.fanCard.findUnique({
    where: { id },
    include: {
      celebrity: true,
      fan: { select: { name: true, email: true, country: true, phone: true } },
      membershipLevel: true,
    },
  });
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  if (!admin) {
    return NextResponse.json({
      card: {
        id: card.id,
        fanNumber: card.fanNumber,
        status: card.status,
        registeredAt: card.registeredAt,
        cardUrl: card.cardUrl,
        qrCode: card.qrCode,
        fanName: card.fan.name,
        fanCountry: card.fan.country,
        membershipLevel: card.membershipLevel?.name ?? null,
        celebrity: {
          name: card.celebrity.name,
          slug: card.celebrity.slug,
          accentColor: card.celebrity.accentColor,
          cardDesign: card.celebrity.cardDesign,
          profileImage: card.celebrity.profileImage,
        },
      },
    });
  }

  return NextResponse.json({ card });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const card = await prisma.fanCard.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    const status = String(body.status).toUpperCase();
    if (!["ACTIVE", "SUSPENDED", "EXPIRED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = status;
  }
  if (body.membershipLevelId !== undefined) {
    if (body.membershipLevelId === null) {
      data.membershipLevelId = null;
    } else {
      const level = await prisma.membershipLevel.findFirst({
        where: { id: String(body.membershipLevelId), celebrityId: card.celebrityId },
      });
      if (!level) return NextResponse.json({ error: "Membership level not found for this celebrity" }, { status: 400 });
      data.membershipLevelId = level.id;
    }
  }

  const updated = await prisma.fanCard.update({ where: { id }, data });
  return NextResponse.json({ card: updated });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const card = await prisma.fanCard.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.fanCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}