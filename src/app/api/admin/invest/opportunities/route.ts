import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { listOpportunities } from "@/lib/invest/opportunities";
import { auditLog } from "@/lib/invest/audit";

export const dynamic = "force-dynamic";

function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "opportunity";
}

function parseDecimal(value: unknown): Prisma.Decimal | null {
  if (value == null) return null;
  const s = String(value).trim();
  return /^\d+(\.\d{1,2})?$/.test(s) ? new Prisma.Decimal(s) : null;
}

// GET /api/admin/invest/opportunities — all opportunities (incl. drafts/closed).
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const opps = await listOpportunities({
    onlyOpen: sp.get("open") === "1",
    investmentType: sp.get("type") || undefined,
    q: sp.get("q")?.trim() || undefined,
  });
  return NextResponse.json({ opportunities: opps });
}

// POST /api/admin/invest/opportunities — create a new offering.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const adminEmail = await adminEmailGuarded();

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const investmentType = String(body.investmentType ?? "PRIVATE_EQUITY").trim();
  if (!name || !investmentType) return NextResponse.json({ error: "name and investmentType are required." }, { status: 400 });

  let slug = toSlug(name);
  let suffix = 2;
  while (await prisma.investmentOpportunity.findUnique({ where: { slug } })) {
    slug = `${toSlug(name)}-${suffix}`;
    suffix += 1;
  }

  const status = String(body.status ?? "DRAFT").toUpperCase();

  try {
    const created = await prisma.investmentOpportunity.create({
      data: {
        slug,
        name,
        companyName: body.companyName ? String(body.companyName).trim() : null,
        investmentType,
        description: body.description ? String(body.description).trim() : null,
        status,
        currency: String(body.currency ?? "USD").toUpperCase(),
        minAmount: parseDecimal(body.minAmount),
        maxAmount: parseDecimal(body.maxAmount),
        targetAmount: parseDecimal(body.targetAmount),
        feesJson: body.feesJson ? JSON.stringify(body.feesJson) : null,
        investmentPeriodJson: body.investmentPeriodJson ? JSON.stringify(body.investmentPeriodJson) : null,
        liquidityText: body.liquidityText ? String(body.liquidityText).trim() : null,
        risksText: body.risksText ? String(body.risksText).trim() : null,
        expectedReturnText: body.expectedReturnText ? String(body.expectedReturnText).trim() : null,
        eligibilityJson: body.eligibilityJson ? JSON.stringify(body.eligibilityJson) : null,
        disclosuresJson: body.disclosuresJson ? JSON.stringify(body.disclosuresJson) : null,
        legalTermsText: body.legalTermsText ? String(body.legalTermsText).trim() : null,
        linkedCelebrityId: body.linkedCelebrityId ? String(body.linkedCelebrityId) : null,
      },
    });
    await auditLog({
      actorType: "admin",
      actorId: adminEmail,
      action: "OPPORTUNITY_CREATED",
      entityType: "InvestmentOpportunity",
      entityId: created.id,
      details: { slug: created.slug, status: created.status },
    }).catch(() => {});
    return NextResponse.json({ opportunity: created }, { status: 201 });
  } catch (err) {
    console.error("[admin/invest/opportunities] create failed:", err);
    return NextResponse.json({ error: "Could not create opportunity." }, { status: 400 });
  }
}

async function adminEmailGuarded(): Promise<string> {
  const { getCurrentAdminEmail } = await import("@/lib/auth");
  return (await getCurrentAdminEmail()) ?? "admin@sistemapocket.dev";
}