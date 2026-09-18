import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentAdminEmail } from "@/lib/auth";
import { sanitizeInvestorProfile, toInvestorView } from "@/lib/profiles/investor";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ celebrityId: string }> };

/**
 * Person-specific business/investment profile for ONE celebrity — keyed 1:1 to
 * the celebrityId in the URL, so an admin can never accidentally edit another
 * person's investment info. Only verified, sourced content may be stored.
 */
export async function GET(_request: Request, { params }: Ctx) {
  if (!(await getCurrentAdminEmail())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { celebrityId } = await params;
  const row = await prisma.investorProfile.findUnique({
    where: { celebrityId },
  });
  return NextResponse.json({ investor: row ? toInvestorView(row) : null });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { celebrityId } = await params;
  const teamEmail = await getCurrentAdminEmail();
  if (!teamEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const investor = sanitizeInvestorProfile(body);
  if (!investor) {
    return NextResponse.json({ error: "Invalid investment profile" }, { status: 400 });
  }

  const celebrity = await prisma.celebrity.findUnique({
    where: { id: celebrityId },
    select: { id: true, profileType: true },
  });
  if (!celebrity) {
    return NextResponse.json({ error: "Celebrity not found" }, { status: 404 });
  }
  // The investment/business section belongs only to business/political
  // profiles — the two systems (CelebrityPass fan system + investment info)
  // are kept fully separate. Entertainment profiles reject investor content.
  if (celebrity.profileType === "entertainment") {
    return NextResponse.json(
      { error: "Investment profiles are only available for business or political profiles." },
      { status: 400 },
    );
  }

  const row = await prisma.investorProfile.upsert({
    where: { celebrityId },
    update: { ...investor, updatedBy: teamEmail },
    create: { celebrityId, ...investor, updatedBy: teamEmail },
  });

  return NextResponse.json({ ok: true, investor: toInvestorView(row) });
}