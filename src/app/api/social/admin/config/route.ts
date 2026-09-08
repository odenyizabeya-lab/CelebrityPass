import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { getSocialConfig } from "@/lib/social/db";

export const dynamic = "force-dynamic";

// GET /api/social/admin/config — automation configuration.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = await getSocialConfig();
  return NextResponse.json(config);
}

// PUT /api/social/admin/config — update automation configuration.
export async function PUT(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);

  const data: Record<string, unknown> = {};
  if (typeof body?.automationEnabled === "boolean") data.automationEnabled = body.automationEnabled;
  if (typeof body?.paused === "boolean") data.paused = body.paused;
  if (body?.approvalMode === "auto" || body?.approvalMode === "approval") data.approvalMode = body.approvalMode;
  if (typeof body?.maxPostsPerDay === "number" && body.maxPostsPerDay >= 1 && body.maxPostsPerDay <= 500) {
    data.maxPostsPerDay = Math.floor(body.maxPostsPerDay);
  }
  if (typeof body?.maxRetries === "number" && body.maxRetries >= 0 && body.maxRetries <= 20) {
    data.maxRetries = Math.floor(body.maxRetries);
  }
  if (typeof body?.retryBackoffMinutes === "number" && body.retryBackoffMinutes >= 1 && body.retryBackoffMinutes <= 1440) {
    data.retryBackoffMinutes = Math.floor(body.retryBackoffMinutes);
  }
  if (typeof body?.dedupeWindowDays === "number" && body.dedupeWindowDays >= 1 && body.dedupeWindowDays <= 365) {
    data.dedupeWindowDays = Math.floor(body.dedupeWindowDays);
  }
  if (Array.isArray(body?.contentTypes)) {
    const allowed = ["celebrity", "membership", "event", "article", "promo"];
    data.contentTypesJson = JSON.stringify(body.contentTypes.filter((c: string) => allowed.includes(c)));
  }

  await prisma.socialConfig.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  return NextResponse.json({ ok: true });
}