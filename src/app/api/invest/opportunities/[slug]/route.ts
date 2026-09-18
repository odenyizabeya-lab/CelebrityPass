import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { getOpportunityBySlug, parseDisclosures } from "@/lib/invest/opportunities";
import { getOrCreateInvestorAccount } from "@/lib/invest/account";

export const dynamic = "force-dynamic";

// GET /api/invest/opportunities/[slug] — detail + the caller’s disclosure state.
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const opp = await getOpportunityBySlug(slug);
  if (!opp) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });

  let disclosures: unknown[] = [];
  let kycStatus = "NOT_STARTED";
  const fanId = await getCurrentFanId();
  if (fanId) {
    const account = await getOrCreateInvestorAccount(fanId);
    kycStatus = account.kycStatus;
    const accepted = await prisma.disclosureAcceptance.findMany({
      where: { investorId: account.id, opportunityId: opp.id },
      select: { documentKey: true, documentVersion: true, acceptedAt: true },
    });
    disclosures = parseDisclosures(opp.disclosuresJson).map((d) => ({
      key: d.key,
      version: d.version,
      title: d.title ?? d.key,
      accepted: accepted.some((a) => a.documentKey === d.key && a.documentVersion === d.version),
    }));
  }

  return NextResponse.json({
    opportunity: {
      id: opp.id,
      slug: opp.slug,
      name: opp.name,
      companyName: opp.companyName,
      investmentType: opp.investmentType,
      description: opp.description,
      status: opp.status,
      acceptingFunds: ["OPEN", "PENDING"].includes(opp.status),
      minAmount: opp.minAmount?.toString() ?? null,
      maxAmount: opp.maxAmount?.toString() ?? null,
      targetAmount: opp.targetAmount?.toString() ?? null,
      raisedAmount: opp.raisedAmount.toString(),
      currency: opp.currency,
      feesJson: safeParse(opp.feesJson),
      investmentPeriodJson: safeParse(opp.investmentPeriodJson),
      liquidityText: opp.liquidityText,
      risksText: opp.risksText,
      expectedReturnText: opp.expectedReturnText,
      eligibilityJson: safeParse(opp.eligibilityJson),
      legalTermsText: opp.legalTermsText,
      linkedCelebritySlug: opp.linkedCelebritySlug,
      linkedCelebrityName: opp.linkedCelebrityName,
      createdAt: opp.createdAt.toISOString(),
      updatedAt: opp.updatedAt.toISOString(),
    },
    disclosures,
    kycStatus,
  });
}

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}