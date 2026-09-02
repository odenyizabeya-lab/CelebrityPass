import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { getEventById } from "@/lib/events/service";
import { isEventType, isEventStatus, isVerification, EVENT_OVERRIDES } from "@/lib/events/types";
import { computeEventStatus } from "@/lib/events/helpers";

export const dynamic = "force-dynamic";

// GET /api/events/[eventId] — public + admin detail (used by event details page).
export async function GET(_: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await getEventById(eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json({ event });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { eventId } = await params;
  const existing = await prisma.celebrityEvent.findUnique({ where: { eventId } });
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = String(body.name ?? "");
  if (body.celebrityId !== undefined) data.celebrityId = String(body.celebrityId ?? "");
  if (body.type !== undefined) data.type = isEventType(String(body.type)) ? body.type : "Other";
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.venue !== undefined) data.venue = body.venue ? String(body.venue) : null;
  if (body.city !== undefined) data.city = body.city ? String(body.city) : null;
  if (body.region !== undefined) data.region = body.region ? String(body.region) : null;
  if (body.country !== undefined) data.country = body.country ? String(body.country) : null;
  if (body.timezone !== undefined) data.timezone = body.timezone ? String(body.timezone) : null;
  if (body.allDay !== undefined) data.allDay = Boolean(body.allDay);
  if (body.officialUrl !== undefined) data.officialUrl = body.officialUrl ? String(body.officialUrl) : null;
  if (body.ticketUrl !== undefined) data.ticketUrl = body.ticketUrl ? String(body.ticketUrl) : null;
  if (body.sourceUrl !== undefined) data.sourceUrl = body.sourceUrl ? String(body.sourceUrl) : null;

  const startAt = body.startAt ? new Date(body.startAt) : existing.startAt;
  const endAt = body.endAt ? new Date(body.endAt) : body.endAt === null ? null : existing.endAt;
  data.startAt = startAt;
  if (body.endAt !== undefined) data.endAt = endAt;
  data.endAt = endAt;

  // Status override (POSTPONED/CANCELLED) or null clears it.
  if (body.status !== undefined) {
    const st = String(body.status);
    if (st === "" || st === "NONE") data.statusOverride = null;
    else if ((EVENT_OVERRIDES as readonly string[]).includes(st)) data.statusOverride = st;
    // A live status (UPCOMING/HAPPENING_NOW/COMPLETED) is derived from dates:
    // sending it clears any manual override.
    else if (isEventStatus(st)) data.statusOverride = null;
  }

  data.status = computeEventStatus({
    statusOverride: (data.statusOverride as string | null) ?? (existing.statusOverride as string | null),
    startAt,
    endAt,
    allDay: (data.allDay as boolean | undefined) ?? existing.allDay,
  });

  if (body.verification !== undefined) {
    const v = String(body.verification);
    data.verification = isVerification(v) ? v : "UNVERIFIED";
    if (v === "VERIFIED" || v === "UPDATED") {
      data.verifiedBy = "admin";
      data.verifiedAt = new Date();
    }
  }

  const updated = await prisma.celebrityEvent.update({ where: { eventId }, data });

  // Log meaningful changes for the audit trail.
  const changed: string[] = [];
  if (body.status !== undefined && String(body.status) !== existing.statusOverride) changed.push("status");
  if (body.verification !== undefined && String(body.verification) !== existing.verification) changed.push("verification");
  if (data.startAt && new Date(data.startAt as Date).getTime() !== new Date(existing.startAt).getTime()) changed.push("startAt");
  if (changed.length > 0) {
    await prisma.eventUpdate.create({
      data: {
        eventId: existing.id,
        field: changed.join(", "),
        fromValue: JSON.stringify({ status: existing.status, startAt: existing.startAt, verification: existing.verification }),
        toValue: JSON.stringify({ status: updated.status, startAt: updated.startAt, verification: updated.verification }),
        source: "admin",
      },
    }).catch(() => undefined);
  }

  const fresh = await getEventById(eventId);
  return NextResponse.json({ event: fresh });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { eventId } = await params;
  const existing = await prisma.celebrityEvent.findUnique({ where: { eventId } });
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  await prisma.celebrityEvent.delete({ where: { eventId } });
  return NextResponse.json({ ok: true });
}
