import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPaymentMethodKind } from "@/lib/ticketing/types";

export const dynamic = "force-dynamic";

// GET /api/tickets/admin/payment-methods
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const methods = await prisma.paymentMethod.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    methods: methods.map((m) => ({
      id: m.id,
      key: m.key,
      name: m.name,
      kind: m.kind,
      isEnabled: m.isEnabled,
      isDefault: m.isDefault,
      currency: m.currency,
      credentialEnvKeys: m.credentialEnvKeysJson ? (JSON.parse(m.credentialEnvKeysJson) as string[]) : [],
      hasCredentials: m.hasCredentials,
      settlementAccountLabel: m.settlementAccountLabel,
      settlementAccountLast4: m.settlementAccountLast4,
      settlementAccountEnvKey: m.settlementAccountEnvKey,
      hasSettlementAccount: m.hasSettlementAccount,
      notes: m.notes,
    })),
  });
}

// POST /api/tickets/admin/payment-methods — create a payment method.
// Credential values are NEVER accepted/stored here — only env var names.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const key = String(body?.key ?? "").trim();
  const name = String(body?.name ?? "").trim();
  if (!key || !name) return NextResponse.json({ error: "key and name are required" }, { status: 400 });

  const existing = await prisma.paymentMethod.findUnique({ where: { key } });
  if (existing) return NextResponse.json({ error: "A payment method with this key already exists" }, { status: 409 });

  const envKeys = Array.isArray(body?.credentialEnvKeys) ? body.credentialEnvKeys.map(String).filter(Boolean) : [];
  const hasCredentials = envKeys.some((v: string) => typeof process.env[v] === "string" && process.env[v]!.length > 0);
  const hasSettlementAccount = Boolean(body?.settlementAccountEnvKey) && Boolean(process.env[String(body.settlementAccountEnvKey)]);

  const method = await prisma.paymentMethod.create({
    data: {
      key,
      name,
      kind: isPaymentMethodKind(String(body?.kind ?? "")) ? String(body.kind) : "CARD",
      isEnabled: Boolean(body?.isEnabled),
      isDefault: Boolean(body?.isDefault),
      currency: String(body?.currency || "USD"),
      credentialEnvKeysJson: JSON.stringify(envKeys),
      hasCredentials,
      configJson: body?.config ? JSON.stringify(body.config) : null,
      settlementAccountLabel: body?.settlementAccountLabel ? String(body.settlementAccountLabel) : null,
      settlementAccountEnvKey: body?.settlementAccountEnvKey ? String(body.settlementAccountEnvKey) : null,
      hasSettlementAccount,
      notes: body?.notes ? String(body.notes) : null,
    },
  });
  if (method.isDefault) {
    await prisma.paymentMethod.updateMany({ where: { id: { not: method.id } }, data: { isDefault: false } });
  }
  return NextResponse.json({ method }, { status: 201 });
}