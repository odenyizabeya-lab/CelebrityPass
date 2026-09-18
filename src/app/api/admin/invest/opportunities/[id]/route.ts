import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed, getCurrentAdminEmail } from "@/lib/auth";
import { auditLog } from "@/lib/invest/audit";
import { getOpportunityById } from "@/lib/invest/opportunities";

export const dynamic = "force-dynamic";

function numOrNull(value: unknown): { toNumber(): number } | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  // Kept as a parseable Decimal string below; this helper only validates.
  return { toNumber: () => Number(s) };
}

// PATCH /api/admin/invest/opportunities/[id] — edit an offering.
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const adminEmail = (await getCurrentAdminEmail()) ?? "admin@sistemapocket.dev";
  const { id } = await context.params;

  const existing = await getOpportunityById(id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    const s = String(body.status).toUpperCase();
    if (["DRAFT", "PENDING", "OPEN", "CLOSED", "PAUSED", "CANCELLED"].includes(s)) {
      data.status = s;
    } else {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
  }
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.companyName !== undefined) data.companyName = body.companyName ? String(body.companyName).trim() : null;
  if (body.investmentType !== undefined) data.investmentType = String(body.investmentType).trim();
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (body.currency !== undefined) data.currency = String(body.currency).toUpperCase();
  for (const field of ["minAmount", "maxAmount", "targetAmount"] as const) {
    if (body[field] !== undefined) {
      const v = numOrNull(body[field]);
      if (v == null) return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      data[field] = v; // Decimal created from string below
    }
  }
  if (body.liquidityText !== undefined) data.liquidityText = body.liquidityText ? String(body.liquidityText).trim() : null;
  if (body.risksText !== undefined) data.risksText = body.risksText ? String(body.risksText).trim() : null;
  if (body.expectedReturnText !== undefined) data.expectedReturnText = body.expectedReturnText ? String(body.expectedReturnText).trim() : null;
  if (body.legalTermsText !== undefined) data.legalTermsText = body.legalTermsText ? String(body.legalTermsText).trim() : null;
  if (body.feesJson !== undefined) data.feesJson = body.feesJson ? JSON.stringify(body.feesJson) : null;
  if (body.investmentPeriodJson !== undefined) data.investmentPeriodJson = body.investmentPeriodJson ? JSON.stringify(body.investmentPeriodJson) : null;
  if (body.eligibilityJson !== undefined) data.eligibilityJson = body.eligibilityJson ? JSON.stringify(body.eligibilityJson) : null;
  if (body.disclosuresJson !== undefined) data.disclosuresJson = body.disclosuresJson ? JSON.stringify(body.disclosuresJson) : null;

  // Amounts arrive as JSON numbers; Prisma expects a Decimal built from a string.
  for (const field of ["minAmount", "maxAmount", "targetAmount"] as const) {
    if (data[field] && typeof data[field] === "object") {
      data[field] = (data[field] as { toString(): string }).toString();
    }
  }

  const updated = await prisma.investmentOpportunity.update({ where: { id }, data });
  await auditLog({
    actorType: "admin",
    actorId: adminEmail,
    action: "OPPORTUNITY_UPDATED",
    entityType: "InvestmentOpportunity",
    entityId: updated.id,
    details: { slug: updated.slug, changed: Object.keys(data) },
  }).catch(() => {});

  return NextResponse.json({ opportunity: updated });
}