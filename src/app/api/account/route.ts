import { NextResponse, type NextRequest } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const fan = await prisma.fan.findUnique({ where: { id: fanId } });
  if (!fan || !fan.isActive) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json({
    fan: {
      id: fan.id,
      name: fan.name,
      email: fan.email,
      phone: fan.phone,
      country: fan.country,
      createdAt: fan.createdAt,
      hasPassword: Boolean(fan.password),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2) return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
    data.name = name;
  }
  if (body.country !== undefined) {
    data.country = String(body.country).trim() || null;
  }
  if (body.phone !== undefined) {
    data.phone = String(body.phone).trim() || null;
  }

  // Password change requires the current password.
  if (body.newPassword !== undefined && body.newPassword !== "") {
    const newPassword = String(body.newPassword);
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
    }
    if (newPassword.length > 200) {
      return NextResponse.json({ error: "New password is too long." }, { status: 400 });
    }
    const fan = await prisma.fan.findUnique({ where: { id: fanId } });
    if (!fan || !fan.password || !verifyPassword(String(body.currentPassword ?? ""), fan.password)) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
    }
    data.password = hashPassword(newPassword);
  }

  const updated = await prisma.fan.update({ where: { id: fanId }, data });

  return NextResponse.json({
    ok: true,
    fan: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      country: updated.country,
      hasPassword: Boolean(updated.password),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const fan = await prisma.fan.findUnique({ where: { id: fanId } });
  if (!fan) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  // Require password confirmation when the account has a password.
  if (fan.password) {
    const currentPassword = String(body?.currentPassword ?? "");
    if (!verifyPassword(currentPassword, fan.password)) {
      return NextResponse.json({ error: "Please enter your current password to confirm deletion." }, { status: 403 });
    }
  }

  // Cascades remove the fan's cards, payments, and memberships.
  await prisma.fan.delete({ where: { id: fanId } });

  const { clearFanSession } = await import("@/lib/auth");
  await clearFanSession();

  return NextResponse.json({ ok: true });
}
