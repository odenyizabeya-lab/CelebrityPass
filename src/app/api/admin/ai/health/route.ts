// GET /api/admin/ai/health — live Gemini key health for the AI Settings page.
// Probes each configured key via the cheap model-listing endpoint (no
// generation/image cost) so the dashboard can show which keys actually work
// and which are blocked by Google. Raw key values NEVER leave the server.
import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  getGeminiKeyHealth,
  type GeminiKeyHealthEntry,
} from "@/lib/ai/settings";

export const dynamic = "force-dynamic";

function publicHealth(h: GeminiKeyHealthEntry) {
  return {
    slot: h.slot,
    label: h.label,
    source: h.source,
    last4: h.last4,
    configured: h.configured,
    result: h.result,
  };
}

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const health = await getGeminiKeyHealth().catch(() => []);
  return NextResponse.json({ health: health.map(publicHealth) });
}