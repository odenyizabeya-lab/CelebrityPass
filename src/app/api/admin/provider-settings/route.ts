// GET /api/admin/provider-settings — Get provider credential status.
// POST /api/admin/provider-settings — Save provider API key.
//   When a key is saved, the provider's event source is auto-created (if
//   missing), enabled, and a sync is triggered so events appear immediately.
// POST /api/admin/provider-settings/test — Test provider connection.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasProviderKey, setProviderKey, PROVIDER_KEY_CONFIGS } from "@/lib/events/sources/provider-settings";
import { runSourceSync } from "@/lib/events/sync";
import { eventProviders } from "@/lib/events/sources/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const providers: Record<string, { label: string; hasKey: boolean; envVar: string }> = {};
  for (const [key, config] of Object.entries(PROVIDER_KEY_CONFIGS)) {
    providers[key] = {
      label: config.label,
      hasKey: await hasProviderKey(key),
      envVar: config.envVar,
    };
  }
  return NextResponse.json({ providers });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.providerKey) {
    return NextResponse.json({ error: "Missing providerKey" }, { status: 400 });
  }

  const providerKey = String(body.providerKey);
  const key = body.key !== undefined ? String(body.key) : "";
  const config = PROVIDER_KEY_CONFIGS[providerKey];
  if (!config) {
    return NextResponse.json({ error: `Unknown provider: ${providerKey}` }, { status: 400 });
  }

  await setProviderKey(providerKey, key);
  const hasKey = await hasProviderKey(providerKey);

  let source: { id: string; enabled: boolean } | null = null;
  if (hasKey) {
    // Auto-provision the provider's event source so only the key is needed.
    source = await prisma.eventSource.findUnique({ where: { key: providerKey } });
    if (!source) {
      const provider = eventProviders.find((p) => p.key === providerKey);
      source = await prisma.eventSource.create({
        data: {
          key: providerKey,
          name: config.label,
          kind: provider ? "api" : "manual",
          enabled: true,
          baseUrl: providerKey === "ticketmaster" ? "https://app.ticketmaster.com/discovery/v2" : null,
          envKey: provider?.credentialEnvVars[0] ?? null,
          hasCredentials: true,
          description: provider?.label ?? null,
        },
      });
    }
    if (!source.enabled) {
      source = await prisma.eventSource.update({ where: { id: source.id }, data: { enabled: true, hasCredentials: true } });
    }
  }

  // Trigger an immediate sync so the newly configured source populates events.
  let syncResult: { ok: boolean; newEvents: number; updatedEvents: number; message?: string } | null = null;
  if (hasKey && source) {
    const result = await runSourceSync(source.id);
    syncResult = {
      ok: result.ok,
      newEvents: result.newEvents,
      updatedEvents: result.updatedEvents,
      message: result.message ?? undefined,
    };
  }

  return NextResponse.json({ providerKey, hasKey, syncResult });
}
