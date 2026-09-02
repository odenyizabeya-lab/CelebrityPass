import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH /api/tickets/admin/payment-methods/[id] — update settings. Credential
// VALUES are never accepted; only env var names / flags / settlement fields
// that are masked in every response.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const exists = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!exists) return NextResponse.json({ error: "Payment method not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};

  if (body?.name !== undefined) data.name = String(body.name ?? "");
  if (body?.isEnabled !== undefined) data.isEnabled = Boolean(body.isEnabled);
  if (body?.isDefault !== undefined) data.isDefault = Boolean(body.isDefault);
  if (body?.currency !== undefined) data.currency = String(body.currency || "USD");
  if (body?.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body?.config !== undefined) data.configJson = body.config ? JSON.stringify(body.config) : null;
  if (body?.settlementAccountLabel !== undefined) data.settlementAccountLabel = body.settlementAccountLabel ? String(body.settlementAccountLabel) : null;

  if (body?.credentialEnvKeys !== undefined) {
    const envKeys = Array.isArray(body.credentialEnvKeys) ? body.credentialEnvKeys.map(String).filter(Boolean) : [];
    data.credentialEnvKeysJson = JSON.stringify(envKeys);
    data.hasCredentials = envKeys.some((v: string) => typeof process.env[v] === "string" && process.env[v]!.length > 0);
  }
  if (body?.settlementAccountEnvKey !== undefined) {
    const envKey = body.settlementAccountEnvKey ? String(body.settlementAccountEnvKey) : null;
    data.settlementAccountEnvKey = envKey;
    data.hasSettlementAccount = Boolean(envKey) && Boolean(process.env[envKey!]);
  }

  const method = await prisma.paymentMethod.update({ where: { id }, data });
  if ((data.isDefault as boolean | undefined) === true) {
    await prisma.paymentMethod.updateMany({ where: { id: { not: method.id } }, data: { isDefault: false } });
  }
  return NextResponse.json({ method });
}

// DELETE /api/tickets/admin/payment-methods/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.paymentMethod.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}