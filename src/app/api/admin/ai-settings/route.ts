import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { hasAiApiKey, setAiApiKey } from "@/lib/ai/settings";

export const dynamic = "force-dynamic";

// GET /api/admin/ai-settings — reports only whether a key is set (never the value).
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ hasKey: await hasAiApiKey() });
}

// POST /api/admin/ai-settings — save (or clear, with "") the AI scan key.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const raw = body?.apiKey;
  if (raw !== undefined && typeof raw !== "string") {
    return NextResponse.json({ error: "apiKey must be a string." }, { status: 400 });
  }
  const key = (raw ?? "").trim();
  if (key.length > 0 && key.length < 10) {
    return NextResponse.json({ error: "That doesn't look like a real API key." }, { status: 400 });
  }
  await setAiApiKey(key);
  return NextResponse.json({ ok: true, hasKey: key.length > 0 });
}