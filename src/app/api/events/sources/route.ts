import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { getEventSources } from "@/lib/events/service";
import { eventProviders } from "@/lib/events/sources/registry";
import { hasProviderKey } from "@/lib/events/sources/provider-settings";

export const dynamic = "force-dynamic";

// GET /api/events/sources — list sources + available providers (admin only).
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sources = await getEventSources();
  const providers = eventProviders.map((p) => ({
    key: p.key,
    label: p.label,
    requiresCredentials: p.requiresCredentials,
    credentialEnvVars: p.credentialEnvVars,
  }));
  return NextResponse.json({ sources, providers });
}

// POST /api/events/sources — create/enable a provider-backed source (admin).
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.providerKey && !body?.key) return NextResponse.json({ error: "providerKey is required" }, { status: 400 });

  const key = String(body.key || body.providerKey);
  const existing = await prisma.eventSource.findUnique({ where: { key } });
  if (existing) return NextResponse.json({ error: "Source already exists" }, { status: 409 });

  const provider = eventProviders.find((p) => p.key === key);
  const hasCreds = provider ? await hasProviderKey(key) : false;
  const source = await prisma.eventSource.create({
    data: {
      key,
      name: body.name ? String(body.name) : provider?.label ?? key,
      kind: body.kind ? String(body.kind) : provider ? "api" : "manual",
      enabled: provider ? (provider.requiresCredentials ? hasCreds : Boolean(body.enabled ?? true)) : Boolean(body.enabled ?? true),
      baseUrl: body.baseUrl ? String(body.baseUrl) : null,
      configJson: body.config ? JSON.stringify(body.config) : null,
      envKey: provider?.credentialEnvVars[0] ?? null,
      hasCredentials: hasCreds,
      description: body.description ? String(body.description) : provider?.label ?? null,
    },
  });
  return NextResponse.json({ source }, { status: 201 });
}
