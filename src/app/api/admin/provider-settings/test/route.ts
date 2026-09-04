// POST /api/admin/provider-settings/test — Test a provider's API connection.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { testProviderConnection } from "@/lib/events/sources/provider-settings";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.providerKey) {
    return NextResponse.json({ error: "Missing providerKey" }, { status: 400 });
  }

  const providerKey = String(body.providerKey);
  try {
    const result = await testProviderConnection(providerKey);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Test failed" }, { status: 500 });
  }
}
