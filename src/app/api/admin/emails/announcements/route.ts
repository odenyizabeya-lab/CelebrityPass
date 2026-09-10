import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { fanOutAnnouncement, type AudienceSpec } from "@/lib/emails/audience";
import { defaultSubject, makeRenderer, resolveCelebrity, dedupePrefixFor, type AnnouncementInput } from "@/lib/emails/announcements";

export const dynamic = "force-dynamic";

const VALID_TEMPLATES = ["NEW_CELEBRITY", "UPDATE", "COMMUNITY", "PROMOTION"] as const;

/** Create + fan out an announcement to the chosen audience. */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Partial<AnnouncementInput> | null;
  if (!body?.audience?.type || !body.template || !VALID_TEMPLATES.includes(body.template as never)) {
    return NextResponse.json({ error: "A valid audience type and template are required" }, { status: 400 });
  }
  const audience = body.audience as AudienceSpec;
  const input: AnnouncementInput = { audience, template: body.template as AnnouncementInput["template"], title: body.title, subject: body.subject, message: body.message };

  const celeb = await resolveCelebrity(audience.celebrityId);
  if (input.template === "NEW_CELEBRITY" && !celeb) {
    return NextResponse.json({ error: "Select the new celebrity for this announcement" }, { status: 400 });
  }

  const subject = await defaultSubject(input);
  const announcement = await prisma.emailAnnouncement.create({
    data: {
      title: input.title?.trim() || subject,
      audienceType: audience.type,
      audienceConfigJson: JSON.stringify(audience),
      template: input.template,
      celebrityId: celeb?.id ?? null,
      subject,
      htmlBody: null,
      status: "SENDING",
    },
  });

  const { targets, enqueued } = await fanOutAnnouncement({
    announcementId: announcement.id,
    audience,
    template: input.template,
    type: input.template,
    subject,
    dedupePrefix: dedupePrefixFor(input.template),
    render: makeRenderer(input, celeb),
  });

  await prisma.emailAnnouncement.update({
    where: { id: announcement.id },
    data: { targetsCount: targets, enqueuedCount: enqueued },
  });

  // Let the queue start immediately (it also runs on the 5-min cron).
  void (await import("@/lib/emails/queue")).processEmailQueue(50).catch(() => {});

  return NextResponse.json(
    { ok: true, announcement: { id: announcement.id, targetsCount: targets, enqueuedCount: enqueued }, subject },
    { status: 201 },
  );
}

/** List announcements (latest first). */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await prisma.emailAnnouncement.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ announcements: rows });
}