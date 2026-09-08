import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getPublicPlatforms } from "@/lib/social/service";
import { getAdapter } from "@/lib/social/adapter";
import { getAccountCredentials } from "@/lib/social/oauth";
import { PLATFORM_META } from "@/lib/social/registry";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/social/admin/api-status
// Live verification of every configured platform + connected account.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const platforms = await getPublicPlatforms();
  const results: Array<{
    key: string;
    name: string;
    envConfigured: boolean;
    requiresApproval: boolean;
    approvalStatus: string;
    accounts: Array<{ id: string; username: string | null; status: string; verify: "ok" | "error" | "skipped"; message?: string }>;
  }> = [];

  for (const platform of platforms) {
    const meta = PLATFORM_META[platform.key as never];
    const entries: typeof results[number]["accounts"] = [];
    const accounts = await prisma.socialAccount.findMany({
      where: { platformKey: platform.key, isConnected: true },
    });
    for (const account of accounts) {
      const creds = await getAccountCredentials(account.id);
      if (!creds) {
        entries.push({ id: account.id, username: account.externalUsername, status: account.status, verify: "error", message: "Token unreadable" });
        continue;
      }
      try {
        const adapter = getAdapter(platform.key as never);
        const check = await adapter.verifyConnection(creds);
        entries.push({
          id: account.id,
          username: account.externalUsername,
          status: check.ok ? "connected" : account.status,
          verify: check.ok ? "ok" : "error",
          message: check.ok ? undefined : check.error,
        });
      } catch (e) {
        entries.push({ id: account.id, username: account.externalUsername, status: account.status, verify: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }
    results.push({
      key: platform.key,
      name: platform.name,
      envConfigured: platform.configuredEnv,
      requiresApproval: meta?.requiresApproval ?? false,
      approvalStatus: platform.approvalStatus,
      accounts: entries,
    });
  }

  return NextResponse.json({ statuses: results });
}