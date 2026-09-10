import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { getPublicPlatforms } from "@/lib/social/service";
import { PLATFORM_META } from "@/lib/social/registry";
import type { PlatformKey } from "@/lib/social/types";

export const dynamic = "force-dynamic";

// GET /api/social/admin/platforms — platform settings + live API status.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const platforms = await getPublicPlatforms();
  return NextResponse.json({ platforms });
}

// PUT /api/social/admin/platforms — update platform settings.
//   body: { key, enabled?, apiStatus?, approvalStatus?, approvalNote?, apiNote? }
export async function PUT(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const key = String(body?.key ?? "");
  const meta = PLATFORM_META[key as PlatformKey];
  if (!meta) return NextResponse.json({ error: "Unknown platform" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body?.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body?.apiStatus === "string") data.apiStatus = body.apiStatus;
  if (typeof body?.apiNote === "string") data.apiNote = body.apiNote || null;
  if (typeof body?.approvalStatus === "string") data.approvalStatus = body.approvalStatus;
  if (typeof body?.approvalNote === "string") data.approvalNote = body.approvalNote || null;

  const hasCreds = meta.credentialEnvKeys.every((k) => Boolean(process.env[k]));
  await prisma.socialPlatform.upsert({
    where: { key },
    update: { ...data, hasCredentials: hasCreds, apiStatus: data.apiStatus ?? (hasCreds ? "configured" : "not_configured") },
    create: { key, name: meta.name, displayOrder: 0, ...data },
  });
  return NextResponse.json({ ok: true });
}