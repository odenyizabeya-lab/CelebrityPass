import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { eventProviders } from "@/lib/events/sources/registry";

export const dynamic = "force-dynamic";

// PATCH /api/events/sources/[id] — update source config/enabled/name (admin).
// Credentials are referenced by env var, never stored directly.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const source = await prisma.eventSource.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  const provider = eventProviders.find((p) => p.key === source.key);
  const hasCreds = provider?.credentialEnvVars.some((v) => typeof process.env[v] === "string" && process.env[v]!.length > 0) ?? source.hasCredentials;

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name ?? "");
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl ? String(body.baseUrl) : null;
  if (body.config !== undefined) data.configJson = body.config ? JSON.stringify(body.config) : null;
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  data.hasCredentials = hasCreds;

  const updated = await prisma.eventSource.update({ where: { id }, data });
  return NextResponse.json({ source: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.eventSource.delete({ where: { id } }).catch(() => {
    throw new Error("Cannot delete source that still has linked events.");
  });
  return NextResponse.json({ ok: true });
}
