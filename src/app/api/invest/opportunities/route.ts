import { NextResponse, type NextRequest } from "next/server";
import { listOpportunities } from "@/lib/invest/opportunities";

export const dynamic = "force-dynamic";

// GET /api/invest/opportunities?q=&type=&open=1 — public list of offerings.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const onlyOpen = sp.get("open") === "1";
  const investmentType = sp.get("type") || undefined;
  const q = sp.get("q")?.trim() || undefined;

  const opps = await listOpportunities({ onlyOpen, investmentType, q });
  return NextResponse.json({
    opportunities: opps.map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      companyName: o.companyName,
      investmentType: o.investmentType,
      status: o.status,
      minAmount: o.minAmount?.toString() ?? null,
      maxAmount: o.maxAmount?.toString() ?? null,
      targetAmount: o.targetAmount?.toString() ?? null,
      raisedAmount: o.raisedAmount.toString(),
      currency: o.currency,
      linkedCelebritySlug: o.linkedCelebritySlug,
      linkedCelebrityName: o.linkedCelebrityName,
      expectedReturnText: o.expectedReturnText,
      liquidityText: o.liquidityText,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}