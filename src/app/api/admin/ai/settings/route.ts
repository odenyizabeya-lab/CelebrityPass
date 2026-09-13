// GET /api/admin/ai/settings — masked AI settings state for the dashboard.
// POST /api/admin/ai/settings — save the Gemini model and/or API keys.
// Keys are stored in AppSetting (server-side) and NEVER returned to the client.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getAiSettingsStatus, setAIModel, setGeminiKey, DEFAULT_AI_MODEL, AI_MODEL_OPTIONS, AI_PROVIDER_NAME } from "@/lib/ai/settings";
import { getAssistantStatus, setAssistantKey, setAssistantModel, setAssistantBaseUrl } from "@/lib/ai/assistantConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getAiSettingsStatus();
  const assistant = await getAssistantStatus();
  return NextResponse.json({ settings, assistant });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (body.model !== undefined) {
    const m = String(body.model ?? "").trim();
    await setAIModel(
      AI_MODEL_OPTIONS.includes(m as (typeof AI_MODEL_OPTIONS)[number])
        ? m
        : DEFAULT_AI_MODEL,
    );
  }
  if (body.primaryKey !== undefined && typeof body.primaryKey === "string") {
    await setGeminiKey("primary", body.primaryKey);
  }
  if (body.backupKey !== undefined && typeof body.backupKey === "string") {
    await setGeminiKey("backup", body.backupKey);
  }
  if (body.assistantKey !== undefined && typeof body.assistantKey === "string") {
    await setAssistantKey(body.assistantKey);
  }
  if (body.assistantModel !== undefined && typeof body.assistantModel === "string") {
    await setAssistantModel(body.assistantModel);
  }
  if (body.assistantBaseUrl !== undefined && typeof body.assistantBaseUrl === "string") {
    await setAssistantBaseUrl(body.assistantBaseUrl);
  }

  const settings = await getAiSettingsStatus();
  const assistant = await getAssistantStatus();
  return NextResponse.json({ settings, assistant, provider: AI_PROVIDER_NAME });
}