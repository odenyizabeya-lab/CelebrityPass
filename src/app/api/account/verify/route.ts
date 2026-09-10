import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentFanId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmailVerification } from "@/lib/emails/senders";

export const dynamic = "force-dynamic";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Create a fresh verification token and email it to the signed-in fan. */
export async function POST() {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const fan = await prisma.fan.findUnique({ where: { id: fanId } });
  if (!fan || !fan.isActive) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (fan.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: {
      fanId: fan.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    await sendEmailVerification(fan, rawToken);
  } catch (err) {
    console.error("[email] Verification resend failed:", err);
    return NextResponse.json({ error: "Could not send the verification email right now." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}