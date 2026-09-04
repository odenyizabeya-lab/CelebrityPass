import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/trust";
import { makeRateLimiter } from "@/lib/secure";
import { sendEmail } from "@/lib/emails";
import { appUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const requestLimiter = makeRateLimiter(5, 60_000);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  if (!requestLimiter(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const fan = await prisma.fan.findUnique({ where: { email } });

  // Always return the same response whether or not the account exists, to
  // avoid revealing which emails have accounts.
  if (!fan || !fan.password) {
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await prisma.passwordResetToken.create({
    data: { fanId: fan.id, tokenHash: hashToken(token), expiresAt },
  });

  const base = appUrl();
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail(
    [fan.email],
    "Reset your CelebrityPass password",
    `<p>Hi ${fan.name},</p>
     <p>We received a request to reset your CelebrityPass password. Use the link below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>
     <p><a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">Reset your password</a></p>
     <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
  );

  if (!sent) {
    return NextResponse.json({
      ok: true,
      message:
        "If an account exists for that email, a reset link has been sent.",
      emailUnconfigured: true,
    });
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
}
