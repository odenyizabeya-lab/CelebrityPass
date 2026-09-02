import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { getAdminEvents } from "@/lib/events/service";
import { isEventType, isVerification } from "@/lib/events/types";
import { computeEventStatus, newEventId } from "@/lib/events/helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const events = await getAdminEvents({
    search: sp.get("search"),
    celebrityId: sp.get("celebrityId"),
    type: sp.get("type"),
    country: sp.get("country"),
    status: sp.get("status"),
    verification: sp.get("verification"),
  });
  return NextResponse.json({ events });
}

// POST create a public event (admin). Data is only what the admin publishes.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const celebrityId = String(body.celebrityId ?? "");
  const name = String(body.name ?? "").trim();
  if (!celebrityId) return NextResponse.json({ error: "Celebrity is required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Event name is required" }, { status: 400 });
  if (!body.startAt) return NextResponse.json({ error: "Start date/time is required" }, { status: 400 });

  const celebrity = await prisma.celebrity.findUnique({ where: { id: celebrityId } });
  if (!celebrity) return NextResponse.json({ error: "Celebrity not found" }, { status: 400 });

  const startAt = new Date(body.startAt);
  const endAt = body.endAt ? new Date(body.endAt) : null;
  const statusOverride = body.statusOverride === "POSTPONED" || body.statusOverride === "CANCELLED" ? body.statusOverride : null;

  // Admin-added events attach to the "admin" source.
  let adminSource = await prisma.eventSource.findUnique({ where: { key: "admin" } });
  if (!adminSource) {
    adminSource = await prisma.eventSource.create({
      data: {
        key: "admin",
        name: "Admin-added public events",
        kind: "manual",
        enabled: true,
        description: "Public events entered directly by an administrator.",
      },
    });
  }

  const eventId = newEventId();
  const verification = isVerification(String(body.verification ?? "")) ? String(body.verification) : "UNVERIFIED";
  const status = computeEventStatus({ statusOverride, startAt, endAt, allDay: Boolean(body.allDay) });

  const event = await prisma.celebrityEvent.create({
    data: {
      eventId,
      celebrityId,
      name,
      type: isEventType(String(body.type ?? "")) ? String(body.type) : "Other",
      description: body.description ? String(body.description) : null,
      venue: body.venue ? String(body.venue) : null,
      city: body.city ? String(body.city) : null,
      region: body.region ? String(body.region) : null,
      country: body.country ? String(body.country) : null,
      startAt,
      endAt,
      timezone: body.timezone ? String(body.timezone) : null,
      allDay: Boolean(body.allDay),
      statusOverride,
      status,
      officialUrl: body.officialUrl ? String(body.officialUrl) : null,
      ticketUrl: body.ticketUrl ? String(body.ticketUrl) : null,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      verification,
      verifiedBy: verification === "VERIFIED" || verification === "UPDATED" ? "admin" : null,
      verifiedAt: verification === "VERIFIED" || verification === "UPDATED" ? new Date() : null,
      lastSyncedAt: new Date(),
    },
  });

  await prisma.eventSourceLink.create({
    data: { eventId: event.id, sourceId: adminSource.id, sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null },
  });

  return NextResponse.json({ event: { id: event.id, eventId: event.eventId } }, { status: 201 });
}
