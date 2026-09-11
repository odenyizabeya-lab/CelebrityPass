import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, requestOrigin } from "@/lib/utils";
import { getCurrentFanId, createFanSession } from "@/lib/auth";
import { issueFanCard } from "@/lib/cards";
import { sendRegistrationEmails } from "@/lib/emails/senders";

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

  let fan = await prisma.fan.findUnique({ where: { email } });

  if (fan) {
    // Existing account — NEVER grant a fresh session off the email alone, or
    // anyone could "join" with a victim's email and take over their account.
    // Only proceed when the caller is already signed in as this fan, the
    // submitted password verifies, or the account has no password yet.
    const current = await getCurrentFanId();
    const authorized = current === fan.id;
    if (!fan.password && password) {
      fan = await prisma.fan.update({ where: { id: fan.id }, data: { password: hashPassword(password) } });
    } else if (!authorized && fan.password && password && !verifyPassword(password, fan.password)) {
      return NextResponse.json({ requiresLogin: true, email, celebritySlug: celebrity.slug }, { status: 200 });
    } else if (!authorized && fan.password && !password) {
      return NextResponse.json({ requiresLogin: true, email, celebritySlug: celebrity.slug }, { status: 200 });
    }
  } else {
    fan = await prisma.fan.create({
      data: {
        name,
        email,
        country: body.country ? String(body.country) : null,
        password: password ? hashPassword(password) : null,
      },
    });
    // New fan → welcome + verification burst (idempotent, never blocks join).
    try {
      await sendRegistrationEmails(fan);
    } catch (err) {
      console.error("[email] Registration email burst failed:", err);
    }
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

  // Fallback (no membership level selected): issue the card instantly. All
  // standard base tiers are paid, so this path only triggers when the fan
  // joins without picking a level.
  const origin = requestOrigin(request.headers);
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