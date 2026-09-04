import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/notification-settings — reports whether email is configured (never the value).
export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const setting = await prisma.appSetting.findUnique({ where: { key: "RESEND_API_KEY" } });
  const from = await prisma.appSetting.findUnique({ where: { key: "EMAIL_FROM" } });
  const envKeySet = Boolean(process.env.RESEND_API_KEY);

  return NextResponse.json({
    hasKey: Boolean(setting?.value) || envKeySet,
    source: setting?.value ? "saved" : envKeySet ? "env" : "none",
    emailFrom: from?.value ?? process.env.EMAIL_FROM ?? null,
  });
}

// POST /api/admin/notification-settings — save or clear the Resend key and FROM address.
export async function POST(request: Request) {
  const authed = await isAdminAuthed();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : null;
  const emailFrom = typeof body?.emailFrom === "string" ? body.emailFrom.trim() : null;

  if (apiKey !== null) {
    if (apiKey === "") {
      await prisma.appSetting.delete({ where: { key: "RESEND_API_KEY" } }).catch(() => undefined);
    } else {
      await prisma.appSetting.upsert({
        where: { key: "RESEND_API_KEY" },
        update: { value: apiKey },
        create: { key: "RESEND_API_KEY", value: apiKey },
      });
    }
  }

  if (emailFrom !== null) {
    if (emailFrom === "") {
      await prisma.appSetting.delete({ where: { key: "EMAIL_FROM" } }).catch(() => undefined);
    } else {
      await prisma.appSetting.upsert({
        where: { key: "EMAIL_FROM" },
        update: { value: emailFrom },
        create: { key: "EMAIL_FROM", value: emailFrom },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
