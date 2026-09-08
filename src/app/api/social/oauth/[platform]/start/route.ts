import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { PLATFORM_META } from "@/lib/social/registry";
import { createOAuthState } from "@/lib/social/oauth";
import { getAdapter } from "@/lib/social/adapter";

export const dynamic = "force-dynamic";

// GET /api/social/oauth/[platform]/start — begin the OAuth flow.
// Admin-authenticated. Responds with { authorizeUrl } so the UI can redirect.
export async function GET(_req: Request, { params }: { params: Promise<{ platform: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { platform } = await params;
  const meta = PLATFORM_META[platform as never];
  if (!meta) return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
  if (!meta.oauth) {
    return NextResponse.json({ error: "This platform uses token entry, not OAuth. Connect it from the accounts page." }, { status: 400 });
  }
  if (!meta.credentialEnvKeys.every((k) => process.env[k])) {
    return NextResponse.json({
      error: `Missing credentials. Set ${meta.credentialEnvKeys.join(", ")} in server env vars for ${meta.name} before connecting.`,
    }, { status: 400 });
  }

  const state = await createOAuthState(platform);
  try {
    const adapter = getAdapter(platform as never);
    const authorizeUrl = adapter.buildAuthUrl({
      clientId: process.env[meta.credentialEnvKeys[0]] ?? "",
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "https://celebritypass.app"}/api/social/oauth/${platform}/callback`,
      state,
      scopes: meta.scopes,
    });
    if (!authorizeUrl) {
      return NextResponse.json({ error: "Platform does not provide an OAuth authorize URL." }, { status: 400 });
    }
    return NextResponse.json({ authorizeUrl, state });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}