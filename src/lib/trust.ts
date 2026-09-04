import type { NextRequest } from "next/server";
import { prisma } from "./db";

/** Best-effort client IP extraction behind a proxy (Vercel/Next). */
export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Send a support-team notification when a contact or data request is received.
 * Delivers via the configured email provider (Resend) if any. If no email
 * provider is configured, the request is still stored in the database and this
 * simply logs a warning — it never silently claims delivery.
 */
export async function notifySupport(subject: string, html: string) {
  const supportTo = (
    (await prisma.appSetting.findUnique({ where: { key: "SUPPORT_EMAIL" } }))?.value ??
    process.env.SUPPORT_EMAIL ??
    "support@celebritypass.app"
  )
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!supportTo.length) {
    console.warn(`[trust] No support email configured; stored locally only: ${subject}`);
    return;
  }

  const { sendEmail } = await import("./emails");
  await sendEmail(supportTo, subject, html).catch((err) => {
    console.error("[trust] Failed to notify support:", err);
  });
}
