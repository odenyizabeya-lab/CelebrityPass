// Minimal, dependency-free Gemini REST client used by the Automatic Celebrity
// Scanner. Server-side only — API keys never leave the backend.
//
// Two capabilities are used:
//   1. Vision identification — send the uploaded image, ask "who is this?"
//   2. Web research — Gemini with the googleSearch grounding tool finds and
//      cites real public facts (no invented bios, URLs, follower counts).
//
// Every step asks for strict JSON output (responseMimeType: application/json +
// responseSchema) so results map cleanly onto the existing admin form.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// A key is only reported as "invalid" when the Gemini API actually confirms it
// (HTTP 401, or 400 with reason API_KEY_INVALID / "api key not valid"). Other
// 403 PERMISSION_DENIED responses mean the key is valid but the project blocks
// the request: billing not enabled for the model, the Generative Language API
// not enabled, or the key restricted (API/IP/referrer allow-lists).
export type AiErrorType =
  | "invalid_key" // Gemini confirmed the key is bad
  | "api_disabled" // Generative Language API not enabled for the project
  | "billing" // key is valid but the model requires billing / a paid plan
  | "project_restriction" // key is valid but restricted so this request is blocked
  | "permission" // valid key, 403 for another reason
  | "model" // model id not found / not available for this key
  | "quota"
  | "unsupported_combination"
  | "server"
  | "network"
  | "timeout";

export class AiCallError extends Error {
  type: AiErrorType;
  status: number;
  constructor(type: AiErrorType, message: string, status = 0) {
    super(message);
    this.type = type;
    this.status = status;
  }
}

export function friendlyAiError(e: unknown): { message: string; detail?: string } {
  if (e instanceof AiCallError) {
    switch (e.type) {
      case "invalid_key":
        return { message: "The Gemini API key was rejected. Check the key in Admin \u2192 AI Settings." };
      case "api_disabled":
        return {
          message: "The Generative Language (Gemini) API is not enabled for this key's Google Cloud project.",
          detail: "Go to console.cloud.google.com \u2192 APIs & Services \u2192 Enable APIs \u2192 search for \"Generative Language API\" \u2192 Enable it. Then test the key again.",
        };
      case "billing":
        return {
          message: "The Gemini key is valid, but this model requires billing on the Google project.",
          detail: "Go to console.cloud.google.com \u2192 Billing \u2192 link a billing account to the project. Free-tier models (gemini-3.6-flash) may also work.",
        };
      case "project_restriction":
        return {
          message: "The Gemini key is valid but restricted \u2014 its API/IP/referrer allow-list blocked this request.",
          detail: "Go to console.cloud.google.com \u2192 Credentials \u2192 edit the key \u2192 under \"API restrictions\" select \"Allow all\" or add \"Generative Language API\".",
        };
      case "permission":
        return {
          message: "Google denied access (403). The key works but this project or model blocks the request.",
          detail: "1) Enable the Generative Language API in Google Cloud Console. 2) Check the key has no restrictive API allow-list. 3) Ensure billing is enabled if using a paid model. Then test again.",
        };
      case "quota":
        return { message: "The Gemini API has reached its limit (quota/rate limit). An automatic fallback key is used if one is configured." };
      case "model":
        return { message: `Gemini model unavailable: ${e.message}. Try a different model in AI Settings.` };
      case "unsupported_combination":
        return { message: "Web research was rejected by the API and could not fall back." };
      case "timeout":
        return { message: "Gemini took too long to respond. Try again in a moment." };
      case "network":
        return { message: "Could not reach the Gemini API (network error). Try again in a moment." };
      default:
        return { message: `Gemini request failed: ${e.message}` };
    }
  }
  return { message: `Gemini request failed: ${e instanceof Error ? e.message : String(e)}` };
}

type GeminiErrorBody = { status: string; reason: string; message: string };

/** Parse the Gemini REST error payload (never contains the API key). */
export function parseGeminiError(text: string): GeminiErrorBody {
  try {
    const j = JSON.parse(text);
    const e = j?.error;
    if (e && typeof e === "object") {
      const reason = Array.isArray(e.details) && typeof e.details[0]?.reason === "string" ? e.details[0].reason : "";
      return { status: String(e.status ?? "").toUpperCase(), reason, message: String(e.message ?? "") };
    }
  } catch {
    /* non-JSON body below */
  }
  return { status: "", reason: "", message: text };
}

export function classifyError(status: number, text: string, hadSearchTool: boolean): AiErrorType {
  const body = parseGeminiError(text);
  const t = body.message.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (status === 401) return "invalid_key"; // unauthenticated — confirmed bad/missing key

  if (status === 429 || body.status === "RESOURCE_EXHAUSTED") return "quota";

  if (status === 404 || body.status === "NOT_FOUND") return "model";

  if (status === 400) {
    if (body.reason === "API_KEY_INVALID" || has("api key not valid", "key is not valid", "invalid api key", "unauthenticated")) {
      return "invalid_key";
    }
    if (body.reason === "PROJECT_INVALID" || body.reason === "USER_PROJECT_INVALID" || has("project not found", "project id")) {
      return "project_restriction";
    }
    if (has("referrer", "ip address", "api key internal", "restriction")) return "project_restriction";
    if (has("model")) return "model";
    if (hadSearchTool && /(search|grounding|schema|mime type|mimetype|not supported|combination|cannot use)/.test(t)) return "unsupported_combination";
    if (has("not enabled", "disabled", "enable")) return "api_disabled";
    return "model";
  }

  if (status === 403) {
    // Google uses 403 for several distinct conditions — check the structured
    // reason field first (most reliable), then fall back to message keywords.
    if (body.reason === "SERVICE_DISABLED") return "api_disabled";
    if (body.reason === "CONSUMER_INVALID") return "project_restriction";
    if (body.reason === "API_KEY_INVALID") return "invalid_key";
    // FAILED_PRECONDITION is Gemini's signal that the model needs billing/paid access.
    if (body.status === "FAILED_PRECONDITION" || has("billing", "paid", "upgrade", "pricing", "payment", "plan")) return "billing";
    if (has("quota", "rate", "limit", "exhausted")) return "quota";
    if (has("not enabled", "disabled", "enable the", "enable it", "enable this", "api key that cannot", "api is not")) return "api_disabled";
    if (has("restricted", "restriction", "ip addresses", "referrer", "android package", "permitted", "allowlisted")) return "project_restriction";
    if (has("not authorized", "not have permission", "does not have permission", "unauthorized", "access denied")) return "permission";
    if (has("model") && has("not available", "not found", "not supported", "not exist")) return "model";
    if (has("api key not valid", "invalid api key")) return "invalid_key";
    return "permission";
  }

  if (status >= 500) return "server";
  return "server";
}

export type GeminiCredentials = { key: string; model: string; label: string };

/** Ordered fallback chain of credentials derived from settings + env. */
export function geminiCredentialCandidates(primary: string, backup: string, model: string): GeminiCredentials[] {
  const out: GeminiCredentials[] = [];
  const push = (key?: string, label?: string) => {
    const k = key?.trim();
    if (k && !out.some((c) => c.key === k)) out.push({ key: k, model, label: label ?? "Gemini key" });
  };
  push(primary, "Gemini primary key");
  push(backup, "Gemini backup key");
  push(process.env.GEMINI_API_KEY, "GEMINI_API_KEY env");
  push(process.env.GEMINI_BACKUP_API_KEY, "GEMINI_BACKUP_API_KEY env");
  return out;
}

function parseDataUri(dataUri: string): { mimeType: string; data: string } {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri.trim());
  if (!m) throw new AiCallError("server", "Invalid image data URI. Upload a clear photo and try again.");
  const bytes = Math.ceil((m[2].length * 3) / 4);
  if (bytes > 12 * 1024 * 1024) throw new AiCallError("server", "Image is too large for scanning (keep it under 12 MB).");
  return { mimeType: m[1], data: m[2] };
}

type CallOptions = {
  credentials: GeminiCredentials;
  system: string;
  userText: string;
  imageDataUri?: string | null;
  schema: Record<string, unknown>;
  useSearch?: boolean;
  temperature?: number;
  timeoutMs?: number;
};

/** Single Gemini generateContent call that returns the parsed JSON payload. */
export async function geminiJson<T>(opts: CallOptions): Promise<T> {
  const { credentials, system, userText, schema, useSearch, temperature } = opts;
  const timeoutMs = opts.timeoutMs ?? 55_000;
  // Key travels in the X-Goog-Api-Key header — never in the URL, so it can't
  // leak into request logs, proxy history, or query-string dumps.
  const url = `${API_BASE}/${encodeURIComponent(credentials.model)}:generateContent`;

  const parts: Array<Record<string, unknown>> = [];
  const img = opts.imageDataUri ? parseDataUri(opts.imageDataUri) : null;
  if (img) parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  parts.push({ text: userText });

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: {
      temperature: temperature ?? 0.2,
      responseMimeType: "application/json",
      responseSchema: schema,
      maxOutputTokens: 8192,
    },
  };
  if (useSearch) body.tools = [{ googleSearch: {} }];

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": credentials.key,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new AiCallError("timeout", `Gemini request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw new AiCallError("network", "Could not reach the Gemini API (network error).");
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new AiCallError(classifyError(res.status, text, Boolean(useSearch)), `Gemini HTTP ${res.status}: ${text.slice(0, 300)}`, res.status);
  }

  let parsed: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiCallError("server", "Gemini returned an unreadable response.");
  }

  const candidateText = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!candidateText.trim()) throw new AiCallError("server", "Gemini returned an empty response (try again).");

  try {
    return JSON.parse(candidateText) as T;
  } catch {
    throw new AiCallError("server", "Gemini returned invalid JSON.");
  }
}

// ---------------------------------------------------------------------------
// Schemas (Gemini OpenAPI-style responseSchema)
// ---------------------------------------------------------------------------
const STRING = { type: "STRING" as const };
const BOOLEAN = { type: "BOOLEAN" as const };
const STRING_NULL = { type: "STRING", nullable: true };
const NUMBER_NULL = { type: "NUMBER", nullable: true };

const IDENTIFY_SCHEMA = {
  type: "OBJECT",
  properties: {
    identified: BOOLEAN,
    best_name: STRING_NULL,
    names: { type: "ARRAY", items: STRING },
    confidence: { type: "STRING", enum: ["high", "low"] },
    reason: STRING_NULL,
  },
  required: ["identified", "best_name", "names", "confidence", "reason"],
};

const PROFILE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: STRING,
    aliases: { type: "ARRAY", items: STRING },
    category: STRING,
    profession: STRING,
    country: STRING,
    city: STRING_NULL,
    bio: STRING,
    short_bio: STRING,
    google_overview: STRING,
    website: STRING_NULL,
    accent_color: STRING,
    followers: {
      type: "OBJECT",
      properties: { instagram: NUMBER_NULL, tiktok: NUMBER_NULL, facebook: NUMBER_NULL },
    },
    socials: {
      type: "OBJECT",
      properties: {
        facebook: STRING_NULL,
        instagram: STRING_NULL,
        tiktok: STRING_NULL,
        google: STRING_NULL,
      },
    },
    card_design: {
      type: "OBJECT",
      properties: { badge_text: STRING_NULL, watermark: STRING_NULL, accent: STRING_NULL },
    },
    base_memberships: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: STRING, description: STRING, price: NUMBER_NULL, currency: STRING },
      },
    },
    source_urls: { type: "ARRAY", items: STRING },
  },
  required: [
    "name",
    "category",
    "profession",
    "country",
    "bio",
    "short_bio",
    "google_overview",
    "accent_color",
    "followers",
    "socials",
    "card_design",
    "base_memberships",
    "source_urls",
  ],
};

const EVENTS_SCHEMA = {
  type: "OBJECT",
  properties: {
    events: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: STRING,
          type: STRING,
          description: STRING_NULL,
          venue: STRING_NULL,
          city: STRING_NULL,
          country: STRING_NULL,
          start_date: STRING,
          start_time: STRING_NULL,
          timezone: STRING_NULL,
          official_url: STRING_NULL,
          source_url: STRING_NULL,
        },
      },
    },
  },
  required: ["events"],
};

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------
const IDENTIFY_SYSTEM = `You are the identity verifier for a celebrity fan-card platform.
Your ONLY job is to decide whether a photo clearly shows a single well-known public figure, and who they are.
Rules:
- If the photo clearly shows a famous person (actor, musician, athlete, creator, politician, royal, artist, entrepreneur, etc.), set identified=true, confidence="high", best_name to their most common public name, and list any other plausible names.
- If the image is unclear, blurry, a group shot, an object, a meme, a child, a private/non-famous person, or you have any real doubt, set identified=false, confidence="low", best_name=null, and explain in reason why a clearer image is needed.
- NEVER guess. It is better to reject a photo than to misidentify a person.`;

export function identifyPerson(c: GeminiCredentials, imageDataUri: string) {
  return geminiJson<{
    identified: boolean;
    best_name: string | null;
    names: string[];
    confidence: "high" | "low";
    reason: string | null;
  }>({
    credentials: c,
    system: IDENTIFY_SYSTEM,
    userText:
      "Look at this photo. Identify whether it clearly shows one well-known public figure. Respond only in JSON per the schema.",
    imageDataUri,
    schema: IDENTIFY_SCHEMA,
    temperature: 0,
  });
}

const PROFILE_SYSTEM = `You are a meticulous celebrity researcher for the "CelebrityPass" fan-card platform.
You research ONE identified person using live web search and return a structured profile for admin review.
Rules:
- Use Google Search grounding to verify every fact. NEVER invent information, URLs, follower counts, or prices from memory alone.
- name: the person's most common public display name.
- category: pick EXACTLY one of: Actor | Musician | Athlete | Creator | Public Figure | Artist.
- profession: concise factual headline, e.g. "Singer & Songwriter" or "Footballer".
- country / city: birthplace or primary residence country/city, null only if truly unknown.
- bio: 2 to 4 factual, neutral paragraphs summarizing their public career (background, notable achievements, current work). Community tone, no hype, no fabricated quotes.
- short_bio: one or two lines for cards and search results.
- google_overview: a 2–4 sentence neutral "knowledge panel" summary for THIS exact person.
- website: the person's verified OFFICIAL website, else null.

SOCIAL LINKS (critical — only these 4 platforms are supported):
socials supports EXACTLY four keys: facebook, instagram, tiktok, google.
- Each URL MUST be the verified OFFICIAL account of THIS exact person, confirmed by the web search results.
- Verification evidence: the account is linked from the person's official website, an official press release, a verified badge on the platform itself, Wikipedia/Wikidata, or consistent listings across authoritative sources (official site, reputable press, the platform's own verified profile). A username or profile name that merely matches the celebrity's name is NOT sufficient proof.
- NEVER use fan accounts, impersonators, tribute pages, unofficial pages, or guessed URLs.
- For google: prefer the person's verified Google presence — an official Google Business/profile or their Google Knowledge Panel — or if none is confirmed, an official-result Google search page for the person (e.g. https://www.google.com/search?q=<person's exact name>). Only provide something when you confirmed it; otherwise null.
- If you could NOT reliably verify an official account on a platform, return null for that platform. Do NOT guess, never fabricate a handle or URL.
- URLs must come from the search results you actually saw.

- followers: published follower counts ONLY when the search results show them; otherwise null (the platform fills realistic placeholders).
- accent_color: suggest a fitting brand hex color (e.g. "#8b5cf6").
- card_design: badge_text like "OFFICIAL FAN MEMBER", a short watermark, and an accent hex.
- base_memberships: EXACTLY 2 paid tiers, matching this platform's standard membership scheme: LEVEL 1 "Premium" priced $1,000 USD and LEVEL 2 "VIP" priced $1,700 USD. There is NO free tier and no other base tier. Keep the names "Premium" and "VIP" exactly; provide an accessible, factual description per tier. Do NOT invent different prices.
- source_urls: the real public URLs (authoritative: official site, verified socials, Wikipedia, reputable press) you actually used for evidence. Include at least 1 and at most 8.
- Return null for anything you could NOT verify. Do not fabricate.`;

function profilePrompt(name: string): string {
  return `Research this celebrity: ${name}.
Return the complete profile JSON for admin review. Only verified facts are allowed.`;
}

export function researchProfile(c: GeminiCredentials, name: string, useSearch: boolean) {
  return geminiJson<{
    name: string;
    aliases?: string[];
    category: string;
    profession: string;
    country: string;
    city: string | null;
    bio: string;
    short_bio: string;
    google_overview: string;
    website: string | null;
    accent_color: string;
    followers: { instagram: number | null; tiktok: number | null; facebook: number | null };
    socials: {
      facebook: string | null;
      instagram: string | null;
      tiktok: string | null;
      google: string | null;
    };
    card_design: { badge_text: string | null; watermark: string | null; accent: string | null };
    base_memberships: Array<{ name: string; description: string; price: number | null; currency: string }>;
    source_urls: string[];
  }>({
    credentials: c,
    system: PROFILE_SYSTEM,
    userText: profilePrompt(name),
    schema: PROFILE_SCHEMA,
    useSearch,
    temperature: 0.2,
  });
}

const EVENTS_SYSTEM = `You are a public-event researcher for "CelebrityPass".
You research ONE celebrity's publicly announced events using live web search and return a JSON list.
Rules:
- Only include PUBLICLY ANNOUNCED events (concerts, tours, festivals, premieres, appearances) that you verified in the web search results.
- Every event MUST include a real source_url from the search results. If you cannot find a credible public source, do NOT include the event.
- type: one of: Concert | Tour | Festival | Public appearance | Award ceremony | Movie premiere | TV appearance | Public interview | Sports appearance | Charity/public event | Other.
- start_date: YYYY-MM-DD of the announced start. start_time: local HH:MM (24h) if announced, else null. timezone: IANA name if known.
- official_url: the artist/venue official event page if found, else null.
- List at least 0 and at most 12 events. Prefer current/upcoming announced events.`;

function eventsPrompt(name: string): string {
  return `Search for ${name}'s publicly announced events (concerts, tours, appearances). Return the JSON list — only verified events with real source URLs.`;
}

export function researchEvents(c: GeminiCredentials, name: string, useSearch: boolean) {
  return geminiJson<{
    events: Array<{
      name: string;
      type: string;
      description: string | null;
      venue: string | null;
      city: string | null;
      country: string | null;
      start_date: string;
      start_time: string | null;
      timezone: string | null;
      official_url: string | null;
      source_url: string | null;
    }>;
  }>({
    credentials: c,
    system: EVENTS_SYSTEM,
    userText: eventsPrompt(name),
    schema: EVENTS_SCHEMA,
    useSearch,
    temperature: 0.2,
  });
}