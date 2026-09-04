// GET /api/admin/provider-settings — Get provider credential status.
// POST /api/admin/provider-settings — Save provider API key.
// POST /api/admin/provider-settings/test — Test provider connection.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { hasProviderKey, setProviderKey, PROVIDER_KEY_CONFIGS } from "@/lib/events/sources/provider-settings";

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
  return NextResponse.json({ providerKey, hasKey });
}
