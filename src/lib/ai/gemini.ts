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

export type AiErrorType = "invalid_key" | "quota" | "model" | "unsupported_combination" | "server" | "network" | "timeout";

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
        return { message: "The Gemini API key was rejected. Check the key in Admin → AI Settings." };
      case "quota":
        return { message: "The Gemini API has reached its limit (quota/rate limit). An automatic fallback key is used if one is configured." };
      case "model":
        return { message: `Gemini model unavailable: ${e.message}` };
      case "unsupported_combination":
        return { message: "Web research was rejected by the API and could not fall back." };
      case "timeout":
        return { message: "Gemini took too long to respond. Try again in a moment." };
      default:
        return { message: `Gemini request failed: ${e.message}` };
    }
  }
  return { message: `Gemini request failed: ${e instanceof Error ? e.message : String(e)}` };
}

function classifyError(status: number, text: string, hadSearchTool: boolean): AiErrorType {
  const t = (text || "").toLowerCase();
  if (status === 401) return "invalid_key";
  if (status === 403) {
    if (t.includes("quota") || t.includes("rate") || t.includes("limit") || t.includes("exhausted")) return "quota";
    return "invalid_key";
  }
  if (status === 429) return "quota";
  if (status === 400) {
    if (t.includes("api key") || t.includes("key is not valid") || t.includes("unauthorized")) return "invalid_key";
    if (t.includes("model")) return "model";
    if (hadSearchTool && /(search|grounding|schema|mime type|mimetype|not supported|combination|cannot use)/.test(t)) {
      return "unsupported_combination";
    }
    return "model";
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
  const url = `${API_BASE}/${encodeURIComponent(credentials.model)}:generateContent?key=${encodeURIComponent(credentials.key)}`;

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    throw new AiCallError("timeout", `Gemini request timed out after ${Math.round(timeoutMs / 1000)}s.`);
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
        instagram: STRING_NULL,
        x: STRING_NULL,
        youtube: STRING_NULL,
        tiktok: STRING_NULL,
        facebook: STRING_NULL,
        official: STRING_NULL,
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
- website: the person's verified OFFICIAL website, else null. socials: verified official profiles only (by handle match with search results), else null. URLs must come from the search results.
- followers: published follower counts ONLY when the search results show them; otherwise null (the platform fills realistic placeholders).
- accent_color: suggest a fitting brand hex color (e.g. "#8b5cf6").
- card_design: badge_text like "OFFICIAL FAN MEMBER", a short watermark, and an accent hex.
- base_memberships: EXACTLY 3 tiers for the fan community, using this platform's existing structure: a free "Member" tier, a paid "Gold" tier, a paid "VIP" tier. Name them with the person's real fandom name when known (e.g. Beyoncé -> "Beyhive Member / Beyhive Gold / Beyhive VIP", Swift -> "Swiftie Member / ...", Messi -> "Culé / ..."), otherwise "{First name} Member / Gold / VIP". Accessible description per tier. price: null for Member; Gold ≈ 9.99–19.99 USD, VIP ≈ 39.99–59.99 USD (only adjust if real official fan-club pricing was verified).
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
      instagram: string | null;
      x: string | null;
      youtube: string | null;
      tiktok: string | null;
      facebook: string | null;
      official: string | null;
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