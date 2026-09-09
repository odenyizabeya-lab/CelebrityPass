// POST /api/admin/ai/settings/test — test a Gemini API key.
//   body: { key?: string, model?: string }
//   Uses the provided key, or the saved/environment keys when omitted.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getGeminiKeys, getAIModel, AI_PROVIDER_NAME } from "@/lib/ai/settings";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const model = body?.model ? String(body.model).trim() : await getAIModel();

  let key = body?.key ? String(body.key).trim() : "";
  if (!key) {
    const keys = await getGeminiKeys();
    key = keys.primary || keys.backup || process.env.GEMINI_API_KEY?.trim() || "";
  }

  if (!key) {
    return NextResponse.json({ ok: false, provider: AI_PROVIDER_NAME, message: "No Gemini API key configured yet." });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with the single word: OK" }] }],
          generationConfig: { maxOutputTokens: 20 },
        }),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text().catch(() => "");
    if (res.ok) {
      return NextResponse.json({ ok: true, provider: AI_PROVIDER_NAME, message: `Connection successful — key is valid on model "${model}".` });
    }

    const lower = text.toLowerCase();
    if (res.status === 401 || res.status === 403 || (res.status === 400 && (lower.includes("api key") || lower.includes("not valid")))) {
      return NextResponse.json({ ok: false, provider: AI_PROVIDER_NAME, message: "Gemini rejected this key (invalid or unauthorized). Double-check it." });
    }
    if (res.status === 429 || lower.includes("quota") || lower.includes("rate limit") || lower.includes("exhausted")) {
      return NextResponse.json({ ok: false, provider: AI_PROVIDER_NAME, message: "Gemini API quota/rate limit reached. Wait or add a fallback key." });
    }
    if (res.status === 400 && lower.includes("model")) {
      return NextResponse.json({ ok: false, provider: AI_PROVIDER_NAME, message: `Model "${model}" is not available for this key.` });
    }
    return NextResponse.json({ ok: false, provider: AI_PROVIDER_NAME, message: `Connection failed (HTTP ${res.status}).` });
  } catch {
    return NextResponse.json({ ok: false, provider: AI_PROVIDER_NAME, message: "Connection timed out. Try again." });
  }
}