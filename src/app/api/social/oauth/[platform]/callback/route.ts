import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeOAuthState, completeOAuthCode } from "@/lib/social/oauth";
import { PLATFORM_META } from "@/lib/social/registry";
import { appUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/social/oauth/[platform]/callback — provider redirect target.
// Validates CSRF state, exchanges the code for tokens, persists them encrypted,
// then bounces the admin back to the accounts page.
export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const meta = PLATFORM_META[platform as never];
  const base = `${appUrl()}/admin/marketing/accounts`;
  if (!meta) return NextResponse.redirect(`${base}?error=Unknown platform`, 302);

  if (error) {
    return NextResponse.redirect(`${base}?error=${encodeURIComponent(errorDescription || error)}`, 302);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${base}?error=Missing+authorization+code`, 302);
  }

  const validState = await consumeOAuthState(state, platform);
  if (!validState) {
    return NextResponse.redirect(`${base}?error=Invalid+or+expired+OAuth+state.+Start+the+connection+again.`, 302);
  }

  try {
    await completeOAuthCode(platform, code);
    return NextResponse.redirect(`${base}?connected=${platform}`, 302);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.socialPostLog.create({
      data: { platformKey: platform, level: "error", message: `OAuth callback failed: ${msg}`, status: "FAILED" },
    });
    return NextResponse.redirect(`${base}?error=${encodeURIComponent(msg.slice(0, 300))}`, 302);
  }
}