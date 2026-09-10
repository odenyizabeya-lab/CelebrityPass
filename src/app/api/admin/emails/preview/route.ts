import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { appUrl } from "@/lib/utils";
import { countAudience, type AudienceSpec } from "@/lib/emails/audience";
import { renderSample, resolveCelebrity, defaultSubject, type AnnouncementInput } from "@/lib/emails/announcements";

export const dynamic = "force-dynamic";

/** Preview: count eligible recipients + render a sample email. */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Partial<AnnouncementInput> | null;
  if (!body?.audience?.type || !body.template) {
    return NextResponse.json({ error: "audience type and template are required" }, { status: 400 });
  }

  const input: AnnouncementInput = {
    audience: body.audience as AudienceSpec,
    template: body.template,
    title: body.title,
    subject: body.subject,
    message: body.message,
  };
  const [count, celeb] = await Promise.all([
    countAudience(input.audience, input.template),
    resolveCelebrity(input.audience.celebrityId),
  ]);
  const subject = await defaultSubject(input);
  const html = renderSample(input, celeb);
  const fullUrl = `${appUrl()}/celebrity/${celeb?.slug ?? ""}`;

  return NextResponse.json({ count, subject, html, previewUrl: fullUrl });
}