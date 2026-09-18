import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed, getCurrentAdminEmail } from "@/lib/auth";
import { auditLog } from "@/lib/invest/audit";

export const dynamic = "force-dynamic";

// GET /api/admin/invest/alerts?open=1 — compliance alerts.
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const open = request.nextUrl.searchParams.get("open") === "1";
  const rows = await prisma.complianceAlert.findMany({
    where: open ? { status: { in: ["OPEN", "REVIEWED"] } } : undefined,
    orderBy: { createdAt: "desc" },
    include: { investor: { select: { investorNumber: true, fan: { select: { email: true } } } } },
    take: 200,
  });
  return NextResponse.json({
    alerts: rows.map((a) => ({
      id: a.id,
      level: a.level,
      ruleKey: a.ruleKey,
      message: a.message,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      investorNumber: a.investor?.investorNumber ?? null,
      investorEmail: a.investor?.fan?.email ?? null,
    })),
  });
}

// PATCH /api/admin/invest/alerts/[id] — resolve an alert.
export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const adminEmail = (await getCurrentAdminEmail()) ?? "admin@sistemapocket.dev";
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const id = segments[segments.length - 1];
  if (!id) return NextResponse.json({ error: "Alert id required." }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (body?.resolve !== true) return NextResponse.json({ error: "Provide resolve: true." }, { status: 400 });

  await prisma.complianceAlert.update({
    where: { id },
    data: { status: "RESOLVED", reviewedById: adminEmail, reviewedAt: new Date() },
  });
  await auditLog({
    actorType: "admin",
    actorId: adminEmail,
    action: "ALERT_RESOLVED",
    entityType: "ComplianceAlert",
    entityId: id,
    details: { to: "RESOLVED" },
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}