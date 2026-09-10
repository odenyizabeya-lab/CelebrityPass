import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/trust";
import { makeRateLimiter } from "@/lib/secure";
import { enqueuePasswordReset } from "@/lib/emails/senders";
import { isEmailProviderConfigured } from "@/lib/emails/provider";
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
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await prisma.passwordResetToken.create({
    data: { fanId: fan.id, tokenHash, expiresAt },
  });

  const base = appUrl();
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  // Durable: written to the email queue with a per-token dedupe key (every
  // reset request gets its own link). The queue retries up to 3 times.
  try {
    await enqueuePasswordReset({ fan, resetUrl, tokenHash });
  } catch (err) {
    console.error("[email] Password reset enqueue failed:", err);
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
    emailUnconfigured: !(await isEmailProviderConfigured()),
  });
}
