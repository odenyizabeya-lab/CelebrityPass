import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { ensureSocialSeed } from "@/lib/social/db";
import { computeNextRun, parseArray } from "@/lib/social/scheduler";

export const dynamic = "force-dynamic";

// GET /api/social/admin/schedules
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSocialSeed().catch(() => undefined);
  const schedules = await prisma.socialSchedule.findMany({
    orderBy: { platformKey: "asc" },
    include: { platform: { select: { name: true, color: true, key: true } } },
  });
  return NextResponse.json({
    schedules: schedules.map((s) => ({
      id: s.id,
      platformKey: s.platformKey,
      platformName: s.platform.name,
      platformColor: s.platform.color,
      name: s.name,
      enabled: s.enabled,
      contentTypes: parseArray(s.contentTypesJson),
      frequency: s.frequency,
      intervalMinutes: s.intervalMinutes,
      times: parseArray(s.timesJson),
      weekdays: parseArray(s.weekdaysJson),
      maxPerDay: s.maxPerDay,
      nextRunAt: s.nextRunAt,
      lastRunAt: s.lastRunAt,
    })),
  });
}

// PUT /api/social/admin/schedules — update one schedule (full replace of editable fields).
export async function PUT(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const platformKey = String(body?.platformKey ?? "");
  if (!platformKey) return NextResponse.json({ error: "platformKey required" }, { status: 400 });

  const allowedTypes = ["celebrity", "membership", "event", "article", "promo"];
  const contentTypes = Array.isArray(body?.contentTypes)
    ? (body.contentTypes as string[]).filter((c) => allowedTypes.includes(c))
    : [];
  const times = Array.isArray(body?.times) ? (body.times as string[]).slice(0, 24) : [];
  const weekdays = Array.isArray(body?.weekdays) ? (body.weekdays as number[]).slice(0, 7) : [];
  const frequency = ["hourly", "daily", "weekly", "custom"].includes(String(body?.frequency)) ? String(body.frequency) : "daily";

  const data: Record<string, unknown> = {
    enabled: Boolean(body?.enabled),
    name: typeof body?.name === "string" ? body.name : null,
    contentTypesJson: JSON.stringify(contentTypes),
    frequency,
    intervalMinutes:
      typeof body?.intervalMinutes === "number" && body.intervalMinutes >= 5
        ? Math.floor(body.intervalMinutes)
        : frequency === "hourly"
          ? 60
          : frequency === "custom"
            ? 1440
            : null,
    timesJson: JSON.stringify(times),
    weekdaysJson: weekdays.length ? JSON.stringify(weekdays) : null,
    maxPerDay: typeof body?.maxPerDay === "number" && body.maxPerDay > 0 ? Math.floor(body.maxPerDay) : null,
  };

  await ensureSocialSeed().catch(() => undefined);
  const schedule = await prisma.socialSchedule.upsert({
    where: { platformKey },
    update: data,
    create: { platformKey, ...data },
  });

  // Recompute the next run immediately.
  const next = computeNextRun(frequency, data.intervalMinutes as number | null, JSON.stringify(times), weekdays.length ? JSON.stringify(weekdays) : null, new Date());
  await prisma.socialSchedule.update({ where: { id: schedule.id }, data: { nextRunAt: next } });

  return NextResponse.json({ ok: true, nextRunAt: next });
}