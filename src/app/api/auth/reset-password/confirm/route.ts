import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/utils";
import { createFanSession } from "@/lib/auth";
import { clientIp } from "@/lib/trust";
import { makeRateLimiter } from "@/lib/secure";

export const dynamic = "force-dynamic";

const confirmLimiter = makeRateLimiter(8, 60_000);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  if (!confirmLimiter(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "");
  const newPassword = String(body?.password ?? "");

  if (!token) return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (newPassword.length > 200) {
    return NextResponse.json({ error: "Password is too long." }, { status: 400 });
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.usedAt) {
    return NextResponse.json({ error: "This reset link is invalid or has already been used." }, { status: 400 });
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
  }

  const fan = await prisma.fan.findUnique({ where: { id: record.fanId } });
  if (!fan || !fan.isActive) {
    return NextResponse.json({ error: "This account is no longer available." }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.fan.update({ where: { id: fan.id }, data: { password: hashPassword(newPassword) } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  await createFanSession(fan.id);

  return NextResponse.json({ ok: true });
}
