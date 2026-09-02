import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/utils";
import { createFanSession } from "@/lib/auth";
import { issueFanCard } from "@/lib/cards";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const slug = String(body.celebritySlug ?? "").trim();
  const celebrity = slug ? await prisma.celebrity.findUnique({ where: { slug } }) : null;
  if (!celebrity || !celebrity.isActive) {
    return NextResponse.json({ error: "Celebrity community not found" }, { status: 404 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!name || !email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "A valid name and email are required" }, { status: 400 });
  }
  const password = typeof body.password === "string" && body.password.trim().length >= 6 ? body.password.trim() : null;

  // Upsert the fan account by email.
  let fan = await prisma.fan.findUnique({ where: { email } });
  if (fan) {
    const patch: Record<string, unknown> = {};
    if (password && !fan.password) patch.password = hashPassword(password);
    if (body.country && !fan.country) patch.country = String(body.country);
    if (Object.keys(patch).length) fan = await prisma.fan.update({ where: { id: fan.id }, data: patch });
  } else {
    fan = await prisma.fan.create({
      data: {
        name,
        email,
        country: body.country ? String(body.country) : null,
        password: password ? hashPassword(password) : null,
      },
    });
  }

  // Idempotency: if the fan already holds a card in THIS community, return it.
  const existing = await prisma.fanCard.findFirst({
    where: { fanId: fan.id, celebrityId: celebrity.id },
    include: { membershipLevel: true },
  });
  if (existing) {
    await createFanSession(fan.id);
    return NextResponse.json({
      card: serializeCard(existing),
      alreadyMember: true,
      requiresPayment: false,
    });
  }

  // Resolve the requested membership level (validated against this celebrity).
  let level: { id: string; name: string; price: number | null; currency: string } | null = null;
  if (body.membershipLevelId) {
    const found = await prisma.membershipLevel.findFirst({
      where: { id: String(body.membershipLevelId), celebrityId: celebrity.id, isActive: true },
      select: { id: true, name: true, price: true, currency: true },
    });
    if (found) level = found;
  }

  await createFanSession(fan.id);

  // Paid level -> create a PENDING payment and send the fan to checkout.
  const amount = level?.price ?? null;
  if (amount != null && amount > 0) {
    const payment = await prisma.payment.create({
      data: {
        fanId: fan.id,
        celebrityId: celebrity.id,
        membershipLevelId: level!.id,
        amount,
        currency: level!.currency || "USD",
        status: "PENDING",
        provider: "mock",
        description: `${celebrity.name} — ${level!.name}`,
      },
    });
    return NextResponse.json({
      fan: { id: fan.id, name: fan.name, email: fan.email },
      celebritySlug: celebrity.slug,
      payment: { id: payment.id, amount, currency: payment.currency, level: level!.name },
      requiresPayment: true,
      alreadyMember: false,
    });
  }

  // Free (or default) level -> issue the card instantly.
  const origin =
    request.headers.get("origin") ??
    request.headers.get("x-forwarded-proto") + "://" + (request.headers.get("x-forwarded-host") ?? "localhost:3000");
  const card = await issueFanCard({ fanId: fan.id, celebrityId: celebrity.id, membershipLevelId: level?.id, origin });

  return NextResponse.json(
    {
      card: serializeCard(card),
      fan: { id: fan.id, name: fan.name, email: fan.email },
      celebritySlug: celebrity.slug,
      requiresPayment: false,
      alreadyMember: false,
    },
    { status: 201 }
  );
}

function serializeCard(card: {
  id: string;
  fanNumber: string;
  status: string;
  registeredAt: Date;
  cardUrl: string | null;
  qrCode: string | null;
  membershipLevel: { name: string } | null;
}) {
  return {
    id: card.id,
    fanNumber: card.fanNumber,
    status: card.status,
    registeredAt: card.registeredAt,
    cardUrl: card.cardUrl,
    qrCode: card.qrCode,
    membershipLevel: card.membershipLevel?.name ?? null,
  };
}