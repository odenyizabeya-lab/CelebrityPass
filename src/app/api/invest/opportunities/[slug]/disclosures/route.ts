import { NextResponse, type NextRequest } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { getOpportunityBySlug } from "@/lib/invest/opportunities";
import { acceptDisclosure, InvestError } from "@/lib/invest/orders";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// POST /api/invest/opportunities/[slug]/disclosures — record an acceptance.
export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const { slug } = await context.params;
  const opp = await getOpportunityBySlug(slug);
  if (!opp) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const documentKey = String(body?.key ?? "").trim();
  const version = String(body?.version ?? "").trim();
  const title = body?.title ? String(body.title).trim() : null;
  if (!documentKey || !version) return NextResponse.json({ error: "Document key and version are required." }, { status: 400 });

  try {
    await acceptDisclosure({
      fanId,
      opportunityId: opp.id,
      documentKey,
      documentVersion: version,
      documentTitle: title,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof InvestError && err.code === "NOT_FOUND") return investErrorResponse(err);
    throw err;
  }
}