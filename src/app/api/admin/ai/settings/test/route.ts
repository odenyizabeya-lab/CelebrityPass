// POST /api/admin/ai/settings/test — test a Gemini API key.
//   body: { key?: string, model?: string }
//   Uses the provided key, or the saved/environment keys when omitted.
//
// The key is sent to Google only via the X-Goog-Api-Key header and is never
// echoed back, logged, or included in any message. The response carries an
// exact `code` (invalid_key / api_disabled / billing / project_restriction /
// permission / model / quota / server / network / timeout / format / none / ok)
// plus a human message. A key is only called "invalid" when the Gemini API
// actually confirms it (HTTP 401, or 400 with API_KEY_INVALID / "api key not
// valid"). Every other failure is reported with its real cause.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { classifyError, type AiErrorType } from "@/lib/ai/client";
import {
  getGeminiKeys,
  getAIModel,
  isPlausibleGeminiKey,
  AI_PROVIDER_NAME,
  type GeminiKeySource,
} from "@/lib/ai/settings";

export const dynamic = "force-dynamic";

type TestCode = AiErrorType | "format" | "none" | "ok";

function messageFor(code: TestCode, model: string): string {
  switch (code) {
    case "invalid_key":
      return "Google rejected the key as invalid (Gemini confirms the key itself is wrong). Double-check the key was copied fully and has no spaces or extra characters.";
    case "api_disabled":
      return "The key is valid, but Google says the Gemini (Generative Language) API is not enabled for this project. Enable it at console.cloud.google.com → APIs & Services → Enable APIs → \"Generative Language API\", then test again.";
    case "billing":
      return `The key is valid, but model "${model}" requires billing on this Google project. Enable billing in Google Cloud (or switch to gemini-3.6-flash), then test again.`;
    case "project_restriction":
      return "The key is valid but restricted — this request was blocked by its restrictions (API/IP/referrer allow-lists). In Google Cloud → Credentials → edit the key → change API restrictions to \"Allow all\" (or add the Generative Language API), then test again.";
    case "permission":
      return `Google denied access (403). The key itself is valid, but the request was blocked at the project level. Fix these, then test again: (1) Enable the Generative Language API at console.cloud.google.com, (2) make sure the key has no restrictive allow-list, (3) enable billing if "${model}" requires it.`;
    case "model":
      return `Model "${model}" was rejected as not found / not available for this project or key. Pick another model in AI Settings.`;
    case "quota":
      return "Gemini quota/rate limit reached. Wait a bit or add a fallback key.";
    case "server":
      return "Google's Gemini API returned an internal error. Try again in a moment.";
    case "network":
      return "Could not reach the Gemini API (network error). Check connectivity and try again.";
    case "timeout":
      return "Gemini did not respond within 25 seconds. Try again.";
    case "format":
      return 'That doesn\'t look like a Google AI key (they start with "AIza" or "AQ."). Check for extra spaces or a truncated paste — the key was NOT sent to Google.';
    case "none":
      return "No Gemini API key is configured. Paste a Google AI Studio key above, or set GEMINI_API_KEY / GEMINI_BACKUP_API_KEY in the server environment.";
    default:
      return "Connection failed. Check the value and try again.";
  }
}

function keySourceLabel(source: GeminiKeySource | "typed" | ""): string {
  return source === "db" ? "stored key" : source === "env" ? "environment variable" : source === "typed" ? "pasted key" : "configured key";
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const model = body?.model ? String(body.model).trim() : await getAIModel();
  const typedKey = body?.key && typeof body.key === "string" ? body.key.trim() : "";

  let key = typedKey;
  let source: GeminiKeySource | "typed" | "" = typedKey ? "typed" : "";
  if (!key) {
    const keys = await getGeminiKeys();
    key = keys.primary || keys.backup || "";
    source = keys.primarySource || keys.backupSource;
  }

  if (!key) {
    return NextResponse.json({ ok: false, code: "none", keySource: "none", provider: AI_PROVIDER_NAME, message: messageFor("none", model) });
  }

  if (!isPlausibleGeminiKey(key)) {
    return NextResponse.json({
      ok: false,
      code: "format",
      keySource: source || "typed",
      provider: AI_PROVIDER_NAME,
      message: messageFor("format", model),
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  let res: Response | null = null;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with the single word: OK" }] }],
        generationConfig: { maxOutputTokens: 20 },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    const code: TestCode = (err as Error)?.name === "AbortError" ? "timeout" : "network";
    return NextResponse.json({ ok: false, code, keySource: source || "typed", provider: AI_PROVIDER_NAME, message: messageFor(code, model) });
  } finally {
    clearTimeout(timer);
  }

  if (!res) {
    return NextResponse.json({ ok: false, code: "server", keySource: source || "typed", provider: AI_PROVIDER_NAME, message: messageFor("server", model) });
  }

  const text = await res.text().catch(() => "");
  if (res.ok) {
    return NextResponse.json({
      ok: true,
      code: "ok",
      keySource: source || "typed",
      provider: AI_PROVIDER_NAME,
      message: `Connection successful — ${keySourceLabel(source)} is valid on model "${model}".`,
    });
  }

  const code = classifyError(res.status, text, false);
  return NextResponse.json({
    ok: false,
    code,
    keySource: source || "typed",
    status: res.status,
    provider: AI_PROVIDER_NAME,
    message: messageFor(code, model),
  });
}