import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { submitKyc } from "@/lib/invest/kyc";
import { getOrCreateInvestorAccount } from "@/lib/invest/account";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// GET /api/invest/kyc — the caller’s KYC status.
export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  const account = await getOrCreateInvestorAccount(fanId);
  const record = await prisma.kycRecord.findUnique({ where: { investorId: account.id } });
  return NextResponse.json({
    kycStatus: account.kycStatus,
    record: record
      ? {
          legalFullName: record.legalFullName,
          documentType: record.documentType,
          country: record.country,
          status: record.status,
          submittedAt: record.submittedAt?.toISOString() ?? null,
          reviewedAt: record.reviewedAt?.toISOString() ?? null,
          reviewNote: record.reviewNote,
        }
      : null,
  });
}

// POST /api/invest/kyc — submit identity verification. Never auto-approves.
export async function POST(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  try {
    const result = await submitKyc({
      fanId,
      legalFullName: body?.legalFullName,
      documentType: body?.documentType,
      country: body?.country,
      dateOfBirth: body?.dateOfBirth ? String(body.dateOfBirth) : null,
      documentRef: body?.documentRef ? String(body.documentRef) : null,
      ipAddress: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({ ok: true, kycStatus: result.kycStatus });
  } catch (err) {
    return investErrorResponse(err);
  }
}